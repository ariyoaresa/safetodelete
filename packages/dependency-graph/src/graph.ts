import type {
  AnalysisNode,
  AnalysisEdge,
  DependantsSummary,
} from "@safetodelete/report-schema";

export class DependencyGraph {
  private nodes: Map<string, AnalysisNode> = new Map();
  private outgoingEdges: Map<string, AnalysisEdge[]> = new Map();
  private incomingEdges: Map<string, AnalysisEdge[]> = new Map();

  public addNode(node: AnalysisNode): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
      this.outgoingEdges.set(node.id, []);
      this.incomingEdges.set(node.id, []);
    }
  }

  public getNode(id: string): AnalysisNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): AnalysisNode[] {
    return Array.from(this.nodes.values());
  }

  public addEdge(edge: AnalysisEdge): void {
    // Ensure nodes exist or register them
    if (!this.nodes.has(edge.from)) {
      this.addNode({ id: edge.from, path: edge.from, kind: "file" });
    }
    if (!this.nodes.has(edge.to)) {
      const isPkg =
        edge.kind === "package-dependency" ||
        (edge.to.startsWith("@")
          ? edge.to.split("/").length <= 2
          : !edge.to.includes("/") && !edge.to.includes("."));
      this.addNode({ id: edge.to, path: edge.to, kind: isPkg ? "package" : "file" });
    }

    this.outgoingEdges.get(edge.from)!.push(edge);
    this.incomingEdges.get(edge.to)!.push(edge);
  }

  public getAllEdges(): AnalysisEdge[] {
    const all: AnalysisEdge[] = [];
    for (const edges of this.outgoingEdges.values()) {
      all.push(...edges);
    }
    return all;
  }

  /**
   * Returns incoming edges to a node (who imports/depends on this node).
   */
  public getIncomingEdges(nodeId: string): AnalysisEdge[] {
    return this.incomingEdges.get(nodeId) || [];
  }

  /**
   * Returns outgoing edges from a node (what does this node import/depend on).
   */
  public getOutgoingEdges(nodeId: string): AnalysisEdge[] {
    return this.outgoingEdges.get(nodeId) || [];
  }

  /**
   * Expands target IDs, resolving any directory prefixes into the individual file nodes they contain.
   */
  public expandTargets(targetIds: string[]): string[] {
    const expanded = new Set<string>();
    const allNodeIds = Array.from(this.nodes.keys());

    for (const target of targetIds) {
      if (this.nodes.has(target)) {
        expanded.add(target);
      }
      const prefix = target.endsWith("/") ? target : `${target}/`;
      for (const nodeId of allNodeIds) {
        if (nodeId.startsWith(prefix)) {
          expanded.add(nodeId);
        }
      }
    }

    return Array.from(expanded);
  }

  /**
   * Finds direct dependants for one or more target node IDs (nodes that directly import the targets).
   */
  public getDirectDependants(targetIds: string[]): string[] {
    const resolvedTargets = this.expandTargets(targetIds);
    const direct = new Set<string>();
    const targetSet = new Set(resolvedTargets);

    for (const id of resolvedTargets) {
      const incoming = this.incomingEdges.get(id) || [];
      for (const edge of incoming) {
        if (!targetSet.has(edge.from)) {
          direct.add(edge.from);
        }
      }
    }

    return Array.from(direct);
  }

  /**
   * Calculates direct and transitive dependants of the given target node IDs.
   * Traverses reverse edges (incoming) using BFS with cycle detection.
   */
  public getImpactSummary(targetIds: string[]): DependantsSummary {
    const resolvedTargets = this.expandTargets(targetIds);
    const directSet = new Set<string>(this.getDirectDependants(resolvedTargets));
    const targetSet = new Set(resolvedTargets);
    const visited = new Set<string>([...resolvedTargets]);
    const queue: string[] = [...directSet];

    for (const d of directSet) {
      visited.add(d);
    }

    const transitiveSet = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const incoming = this.incomingEdges.get(current) || [];

      for (const edge of incoming) {
        if (!visited.has(edge.from)) {
          visited.add(edge.from);
          if (!targetSet.has(edge.from) && !directSet.has(edge.from)) {
            transitiveSet.add(edge.from);
          }
          queue.push(edge.from);
        }
      }
    }

    return {
      direct: Array.from(directSet).sort(),
      transitive: Array.from(transitiveSet).sort(),
    };
  }

  /**
   * Returns true if a node has zero incoming static references.
   */
  public isOrphan(nodeId: string): boolean {
    const incoming = this.incomingEdges.get(nodeId) || [];
    return incoming.length === 0;
  }
}
