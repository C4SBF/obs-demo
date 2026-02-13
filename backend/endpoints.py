"""Discovery-only API endpoint definitions with typed graph responses."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
import urllib.request

import yaml
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from obs.classifier import (
    ClassifyOptions as ClassifierOptions,
    TopologyInput as ClassifierTopologyInput,
    classify_graph_sync,
)
from obs.discovery import discover_objects, objects_result_to_graph, scan_network
from obs.discovery.types import Device, Protocol
from obs.graph import Edge, Graph, GraphMeta, Node
from obs.llm import LLMOptions, enhance_graph_sync

router = APIRouter()
logger = logging.getLogger(__name__)


# Pydantic models that mirror the unified Graph types for API serialization
class NodeResponse(BaseModel):
    """API representation of a graph node."""

    id: str
    type: str
    tags: list[str] = Field(default_factory=list)
    attrs: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_node(cls, node: Node) -> "NodeResponse":
        return cls(
            id=node.id, type=node.type, tags=list(node.tags), attrs=dict(node.attrs)
        )

    def to_node(self) -> Node:
        return Node(
            id=self.id, type=self.type, tags=list(self.tags), attrs=dict(self.attrs)
        )


class EdgeResponse(BaseModel):
    """API representation of a graph edge."""

    source: str
    target: str
    type: str
    attrs: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_edge(cls, edge: Edge) -> "EdgeResponse":
        return cls(
            source=edge.source,
            target=edge.target,
            type=edge.type,
            attrs=dict(edge.attrs),
        )

    def to_edge(self) -> Edge:
        return Edge(
            source=self.source,
            target=self.target,
            type=self.type,
            attrs=dict(self.attrs),
        )


class GraphMetaResponse(BaseModel):
    """API representation of graph metadata."""

    created_at: str = ""
    source: str = ""
    input: dict[str, Any] = Field(default_factory=dict)
    timings: dict[str, Any] = Field(default_factory=dict)
    success: bool = True
    errors: list[str] = Field(default_factory=list)
    error_details: list[dict[str, Any]] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_meta(cls, meta: GraphMeta) -> "GraphMetaResponse":
        return cls(
            created_at=meta.created_at,
            source=meta.source,
            input=dict(meta.input),
            timings=dict(meta.timings),
            success=meta.success,
            errors=list(meta.errors),
            error_details=list(meta.error_details),
            extra=dict(meta.extra),
        )

    def to_meta(self) -> GraphMeta:
        return GraphMeta(
            created_at=self.created_at,
            source=self.source,
            input=dict(self.input),
            timings=dict(self.timings),
            success=self.success,
            errors=list(self.errors),
            error_details=list(self.error_details),
            extra=dict(self.extra),
        )


class GraphResponse(BaseModel):
    """API representation of a graph."""

    nodes: list[NodeResponse] = Field(default_factory=list)
    edges: list[EdgeResponse] = Field(default_factory=list)
    meta: GraphMetaResponse = Field(default_factory=GraphMetaResponse)

    @classmethod
    def from_graph(cls, graph: Graph) -> "GraphResponse":
        return cls(
            nodes=[NodeResponse.from_node(n) for n in graph.nodes],
            edges=[EdgeResponse.from_edge(e) for e in graph.edges],
            meta=GraphMetaResponse.from_meta(graph.meta),
        )

    def to_graph(self) -> Graph:
        return Graph(
            nodes=[n.to_node() for n in self.nodes],
            edges=[e.to_edge() for e in self.edges],
            meta=self.meta.to_meta(),
        )


class DeviceCensusEntry(BaseModel):
    device_address: str
    device_id: int
    device_name: str | None = None
    vendor: str | None = None
    object_count: int = 0
    device_uid: str | None = None


class ClassifyRequest(BaseModel):
    graph: GraphResponse
    topology: dict[str, Any]
    options: dict[str, Any] = Field(default_factory=dict)


class ClassifyResponse(BaseModel):
    graph: GraphResponse


class EnhanceRequest(BaseModel):
    graph: GraphResponse
    options: dict[str, Any] = Field(default_factory=dict)


class EnhancementResponse(BaseModel):
    node_id: str
    original_class: str | None
    original_confidence: float
    suggested_class: str
    llm_confidence: float
    reasoning: str
    applied: bool


class EnhanceResponse(BaseModel):
    graph: GraphResponse
    enhancements: list[EnhancementResponse] = Field(default_factory=list)
    success: bool = True
    errors: list[str] = Field(default_factory=list)
    nodes_evaluated: int = 0
    nodes_enhanced: int = 0


class OntologyInfo(BaseModel):
    id: str
    name: str
    version: str | None = None
    url: str | None = None


_last_census_lock = asyncio.Lock()
_last_device_uids_by_id: dict[int, str] = {}
_ONTOLOGIES: dict[str, OntologyInfo] = {
    "brick_v1.4.4": OntologyInfo(
        id="brick_v1.4.4",
        name="Brick",
        version="1.4.4",
        url="https://brickschema.org/schema/1.4.4/Brick.jsonld",
    )
}


def _device_to_census(device: Device) -> DeviceCensusEntry:
    protocol_ref = device.protocol_ref
    if protocol_ref is None or protocol_ref.device_id is None:
        raise ValueError(f"Device {device.uid} is missing protocol_ref.device_id")
    try:
        device_id = int(protocol_ref.device_id)
    except ValueError as exc:
        raise ValueError(
            f"Device {device.uid} has non-integer protocol_ref.device_id={protocol_ref.device_id!r}"
        ) from exc
    return DeviceCensusEntry(
        device_address=protocol_ref.address,
        device_id=device_id,
        device_name=device.name,
        vendor=device.manufacturer,
        object_count=len(device.points),
        device_uid=device.uid,
    )


@router.get("/discover", response_model=list[DeviceCensusEntry])
async def discover_census(
    timeout: int = Query(60, ge=1, le=600),
    client_ip: str | None = Query(None),
    bbmd_ip: str | None = Query(None),
) -> list[DeviceCensusEntry]:
    """Run BACnet network discovery and return graph + census."""
    census: list[DeviceCensusEntry] = []
    uid_map: dict[int, str] = {}

    logger.info("Starting network discovery (timeout=%ss)", timeout)
    result = await scan_network(
        protocol=Protocol.BACNET,
        timeout=timeout,
        client_ip=client_ip,
        bbmd_ip=bbmd_ip,
    )
    if not result.success:
        detail = "; ".join(result.errors) or "Unknown BACnet scan failure"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Network scan failed: {detail}",
        )

    for device in result.data:
        census_row = _device_to_census(device)
        census.append(census_row)
        uid_map[census_row.device_id] = device.uid

    async with _last_census_lock:
        _last_device_uids_by_id.clear()
        _last_device_uids_by_id.update(uid_map)

    logger.info("Network discovery complete: %s devices found", len(census))
    return census


@router.get("/discover/{device_id}/objects", response_model=GraphResponse)
async def discover_device_objects(
    device_id: int,
    client_ip: str | None = Query(None),
    bbmd_ip: str | None = Query(None),
    rpm_batch_size: int = Query(10, ge=1, le=100),
) -> GraphResponse:
    """Discover all objects for one device and return a graph payload."""
    async with _last_census_lock:
        uid = _last_device_uids_by_id.get(device_id)
    if uid is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found in last census. Run GET /discover first.",
        )

    logger.info("Starting object scan for device_id=%s uid=%s", device_id, uid)
    result = await discover_objects(
        uid,
        client_ip=client_ip,
        bbmd_ip=bbmd_ip,
        rpm_batch_size=rpm_batch_size,
    )
    if not result.success:
        detail = "; ".join(result.errors) or "Unknown BACnet object discovery failure"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan device {device_id}: {detail}",
        )

    return GraphResponse.from_graph(objects_result_to_graph(result))


@router.post("/classify", response_model=ClassifyResponse)
def classify_graph_endpoint(body: ClassifyRequest) -> ClassifyResponse:
    """Classify a graph with topology input and return enriched graph."""
    try:
        # Convert Pydantic model to unified Graph
        graph_input = body.graph.to_graph()
        topology_payload = dict(body.topology)
        topology_id = topology_payload.get("id")
        if (
            isinstance(topology_id, str)
            and not topology_payload.get("url")
            and not topology_payload.get("content")
        ):
            known = _ONTOLOGIES.get(topology_id)
            if known and known.url:
                topology_payload["url"] = known.url
        topology = ClassifierTopologyInput(
            id=topology_payload.get("id"),
            url=topology_payload.get("url"),
            content=topology_payload.get("content"),
            format=topology_payload.get("format"),
        )
        options = ClassifierOptions(
            min_confidence=float(body.options.get("min_confidence", 0.5)),
            use_llm=bool(body.options.get("use_llm", False)),
            metadata=dict(body.options.get("metadata", {}))
            if isinstance(body.options.get("metadata"), dict)
            else {},
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid classify request: {exc}",
        ) from exc

    result = classify_graph_sync(graph_input, topology, options=options)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result.errors[0] if result.errors else "Classification failed",
        )

    return ClassifyResponse(graph=GraphResponse.from_graph(result.graph))


@router.post("/enhance", response_model=EnhanceResponse)
def enhance_graph_endpoint(body: EnhanceRequest) -> EnhanceResponse:
    """Enhance a classified graph using LLM to improve low-confidence classifications."""
    try:
        graph_input = body.graph.to_graph()

        # Build LLM options from request - default to transformers backend
        opts_dict = dict(body.options)
        llm_options = LLMOptions(
            backend=opts_dict.get("backend", "transformers"),
            model=opts_dict.get("model", "HuggingFaceTB/SmolLM2-1.7B-Instruct"),
            base_url=opts_dict.get("base_url", "http://localhost:11434/v1"),
            min_confidence_threshold=float(
                opts_dict.get("min_confidence_threshold", 0.7)
            ),
            batch_size=int(opts_dict.get("batch_size", 10)),
            force=bool(opts_dict.get("force", False)),
        )

        # Log enhancement request details
        nodes_with_class = [n for n in graph_input.nodes if "class" in n.attrs]
        low_confidence = [
            n
            for n in nodes_with_class
            if n.attrs.get("class_confidence", 0.0)
            < llm_options.min_confidence_threshold
        ]
        logger.info(
            "Enhance request: %d nodes, %d classified, %d below threshold %.2f",
            len(graph_input.nodes),
            len(nodes_with_class),
            len(low_confidence),
            llm_options.min_confidence_threshold,
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid enhance request: {exc}",
        ) from exc

    result = enhance_graph_sync(graph_input, options=llm_options)

    applied_count = sum(1 for e in result.enhancements if e.applied)
    logger.info(
        "Enhance result: success=%s, enhancements=%d, applied=%d, errors=%s",
        result.success,
        len(result.enhancements),
        applied_count,
        result.errors or "none",
    )

    enhancements = [
        EnhancementResponse(
            node_id=e.node_id,
            original_class=e.original_class,
            original_confidence=e.original_confidence,
            suggested_class=e.suggested_class,
            llm_confidence=e.llm_confidence,
            reasoning=e.reasoning,
            applied=e.applied,
        )
        for e in result.enhancements
    ]

    return EnhanceResponse(
        graph=GraphResponse.from_graph(result.graph),
        enhancements=enhancements,
        success=result.success,
        errors=result.errors,
        nodes_evaluated=result.metadata.get("nodes_evaluated", 0),
        nodes_enhanced=result.metadata.get("nodes_enhanced", 0),
    )


class LLMStatusResponse(BaseModel):
    available: bool
    backend: str | None = None
    model: str | None = None


@router.get("/llm/status", response_model=LLMStatusResponse)
def get_llm_status() -> LLMStatusResponse:
    """Check if LLM enhancement is available (AI dependencies installed)."""
    try:
        # Try importing torch - if it fails, AI deps are not installed
        import torch  # noqa: F401
        from transformers import AutoModelForCausalLM  # noqa: F401

        return LLMStatusResponse(
            available=True,
            backend="transformers",
            model="HuggingFaceTB/SmolLM2-1.7B-Instruct",
        )
    except ImportError:
        return LLMStatusResponse(available=False)


@router.get("/ontologies", response_model=list[OntologyInfo])
def list_ontologies() -> list[OntologyInfo]:
    """List available ontologies for classifier topology selection."""
    return list(_ONTOLOGIES.values())


@router.get("/ontologies/{ontology_id}", response_model=Any)
def get_ontology(ontology_id: str) -> Any:
    """Fetch ontology payload for preview."""
    ontology = _ONTOLOGIES.get(ontology_id)
    if ontology is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ontology '{ontology_id}' not found",
        )
    if not ontology.url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ontology '{ontology_id}' does not define a URL",
        )
    try:
        with urllib.request.urlopen(ontology.url, timeout=20) as response:
            payload_raw = response.read()
        try:
            return json.loads(payload_raw)
        except json.JSONDecodeError:
            payload_text = payload_raw.decode("utf-8", errors="replace")
            return yaml.safe_load(payload_text)
    except (OSError, json.JSONDecodeError, yaml.YAMLError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch ontology '{ontology_id}': {exc}",
        ) from exc
