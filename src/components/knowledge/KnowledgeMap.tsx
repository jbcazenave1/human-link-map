import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

export type Proximity = "fort" | "moyen" | "faible";

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  comment?: string;
  proximity: Proximity; // proximité par rapport à vous
  position?: { x: number; y: number };
}

export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  proximity: Proximity; // proximité entre les deux personnes
}

const STORAGE_KEY = "knowledge-map-v1";

const proximityLabel: Record<Proximity, string> = {
  fort: "Fort",
  moyen: "Moyen",
  faible: "Faible",
};

const proximityEdgeStyle: Record<Proximity, Partial<Edge["style"]>> = {
  fort: { stroke: "hsl(var(--primary))", strokeWidth: 3 },
  moyen: { stroke: "hsl(var(--accent))", strokeWidth: 2 },
  faible: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "6 6" },
};

function genId(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function useLocalState() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setPersons(parsed.persons ?? []);
        setRelations(parsed.relations ?? []);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ persons, relations }));
  }, [persons, relations]);

  return { persons, setPersons, relations, setRelations };
}

interface PersonFormProps {
  initial?: Partial<Person>;
  onSubmit: (data: Omit<Person, "id">) => void;
  submitLabel?: string;
}

function PersonForm({ initial, onSubmit, submitLabel = "Ajouter" }: PersonFormProps) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [proximity, setProximity] = useState<Proximity>(initial?.proximity ?? "moyen");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!firstName || !lastName) {
          toast({ title: "Champs requis", description: "Prénom et nom sont obligatoires" });
          return;
        }
        onSubmit({ firstName, lastName, company, comment, proximity });
      }}
    >
      <div className="grid gap-2">
        <Label>Prénom</Label>
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ex: Marie" />
      </div>
      <div className="grid gap-2">
        <Label>Nom</Label>
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ex: Dupont" />
      </div>
      <div className="grid gap-2">
        <Label>Entreprise</Label>
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ex: Acme" />
      </div>
      <div className="grid gap-2">
        <Label>Commentaire</Label>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Notes, contexte, objectifs…" rows={4} />
      </div>
      <div className="grid gap-2">
        <Label>Proximité (avec vous)</Label>
        <Select value={proximity} onValueChange={(v) => setProximity(v as Proximity)}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fort">Fort</SelectItem>
            <SelectItem value="moyen">Moyen</SelectItem>
            <SelectItem value="faible">Faible</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full">{submitLabel}</Button>
    </form>
  );
}

interface RelationEditorProps {
  value: Proximity;
  onChange: (p: Proximity) => void;
}

function RelationSelector({ value, onChange }: RelationEditorProps) {
  return (
    <div className="grid gap-2">
      <Label>Niveau de proximité du lien</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Proximity)}>
        <SelectTrigger>
          <SelectValue placeholder="Sélectionner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fort">Fort</SelectItem>
          <SelectItem value="moyen">Moyen</SelectItem>
          <SelectItem value="faible">Faible</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export default function KnowledgeMap() {
  const { persons, setPersons, relations, setRelations } = useLocalState();
  const [selectedNode, setSelectedNode] = useState<Person | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Relation | null>(null);
  const [pendingConnect, setPendingConnect] = useState<Connection | null>(null);

  const initialNodes: Node[] = useMemo(() => {
    return persons.map((p): Node => {
      const bg = p.proximity === "fort"
        ? "hsl(var(--proximity-strong))"
        : p.proximity === "moyen"
        ? "hsl(var(--proximity-medium))"
        : "hsl(var(--proximity-weak))";
      return {
        id: p.id,
        position: p.position ?? { x: Math.random() * 400, y: Math.random() * 300 },
        data: { label: `${p.firstName} ${p.lastName}${p.company ? ` — ${p.company}` : ""}`, person: p },
        type: "default",
        style: {
          borderColor: "transparent",
          background: bg,
          color: "hsl(var(--proximity-foreground))",
        },
      };
    });
  }, [persons]);

  const initialEdges: Edge[] = useMemo(() => {
    return relations.map((r) => ({
      id: r.id,
      source: r.sourceId,
      target: r.targetId,
      label: proximityLabel[r.proximity],
      type: "smoothstep",
      animated: r.proximity === "fort",
      style: proximityEdgeStyle[r.proximity],
    }));
  }, [relations]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when people/relations change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    setPendingConnect(connection);
  }, []);

  const commitConnection = useCallback((proximity: Proximity) => {
    if (!pendingConnect?.source || !pendingConnect?.target) return;
    const newRel: Relation = {
      id: genId("rel"),
      sourceId: String(pendingConnect.source),
      targetId: String(pendingConnect.target),
      proximity,
    };
    setRelations((prev) => [...prev, newRel]);
    setPendingConnect(null);
    toast({ title: "Lien ajouté", description: `Proximité: ${proximityLabel[proximity]}` });
  }, [pendingConnect, setRelations]);

  const onAddPerson = (data: Omit<Person, "id">) => {
    const p: Person = { id: genId("p"), ...data };
    setPersons((prev) => [...prev, p]);
    toast({ title: "Personne ajoutée", description: `${data.firstName} ${data.lastName}` });
  };

  const onUpdatePerson = (id: string, data: Omit<Person, "id">) => {
    setPersons((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    toast({ title: "Modifié", description: `${data.firstName} ${data.lastName}` });
  };

  const onDeletePerson = (id: string) => {
    setPersons((prev) => prev.filter((p) => p.id !== id));
    setRelations((prev) => prev.filter((r) => r.sourceId !== id && r.targetId !== id));
    setSelectedNode(null);
  };

  const onEdgeClick = (_: any, edge: Edge) => {
    const r = relations.find((rr) => rr.id === edge.id);
    if (r) setSelectedEdge(r);
  };

  // Persist positions on drag stop
  const onNodeDragStop = (_: any, node: Node) => {
    setPersons((prev) => prev.map((p) => (p.id === node.id ? { ...p, position: node.position } : p)));
  };

  const exportExcel = () => {
    const personRows = persons.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      company: p.company ?? "",
      comment: p.comment ?? "",
      proximity: p.proximity,
      x: p.position?.x ?? "",
      y: p.position?.y ?? "",
    }));
    const relationRows = relations.map((r) => ({ ...r }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(personRows);
    const ws2 = XLSX.utils.json_to_sheet(relationRows);
    XLSX.utils.book_append_sheet(wb, ws1, "Persons");
    XLSX.utils.book_append_sheet(wb, ws2, "Relations");
    XLSX.writeFile(wb, "knowledge-map.xlsx");
  };

  const importExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const personsSheet = wb.Sheets["Persons"];
      const relationsSheet = wb.Sheets["Relations"];
      if (!personsSheet || !relationsSheet) {
        toast({ title: "Fichier invalide", description: "Feuilles attendues: Persons, Relations" });
        return;
      }
      const pRows = XLSX.utils.sheet_to_json<any>(personsSheet);
      const rRows = XLSX.utils.sheet_to_json<any>(relationsSheet);
      const importedPersons: Person[] = pRows.map((row) => ({
        id: String(row.id ?? genId("p")),
        firstName: String(row.firstName ?? ""),
        lastName: String(row.lastName ?? ""),
        company: row.company ? String(row.company) : undefined,
        comment: row.comment ? String(row.comment) : undefined,
        proximity: (row.proximity as Proximity) ?? "moyen",
        position: typeof row.x === "number" && typeof row.y === "number" ? { x: row.x, y: row.y } : undefined,
      }));
      const importedRelations: Relation[] = rRows.map((row) => ({
        id: String(row.id ?? genId("rel")),
        sourceId: String(row.sourceId ?? ""),
        targetId: String(row.targetId ?? ""),
        proximity: (row.proximity as Proximity) ?? "moyen",
      }));
      setPersons(importedPersons);
      setRelations(importedRelations);
      toast({ title: "Import réussi", description: `${importedPersons.length} personnes, ${importedRelations.length} liens` });
    };
    reader.readAsArrayBuffer(file);
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full relative">
      <aside className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-background" />

      <div className="flex-1 rounded-lg border overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(c) => onConnect(c)}
          onNodeClick={(_, n) => {
            const p = persons.find((pp) => pp.id === n.id) ?? null;
            setSelectedNode(p);
          }}
          onEdgeClick={onEdgeClick}
          onNodeDragStop={onNodeDragStop}
          fitView
          attributionPosition="top-right"
        >
          <MiniMap pannable zoomable />
          <Controls />
          <Background />
        </ReactFlow>
      </div>

      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Ajouter</Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-96">
            <SheetHeader>
              <SheetTitle>Nouvelle personne</SheetTitle>
            </SheetHeader>
            <div className="py-4">
              <PersonForm onSubmit={onAddPerson} />
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <Label>Importer</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importExcel(f);
                }}
              />
              <Button variant="outline" onClick={exportExcel}>Exporter (.xlsx)</Button>
            </div>
          </SheetContent>
        </Sheet>
        <Button variant="outline" onClick={exportExcel}>Exporter</Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirm("Réinitialiser toutes les données ?")) {
              setPersons([]);
              setRelations([]);
            }
          }}
        >
          Réinitialiser
        </Button>
      </div>

      {/* Edit person dialog */}
      <Dialog open={!!selectedNode} onOpenChange={(o) => !o && setSelectedNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la fiche</DialogTitle>
          </DialogHeader>
          {selectedNode && (
            <div className="space-y-4">
              <PersonForm
                initial={selectedNode}
                submitLabel="Enregistrer"
                onSubmit={(data) => onUpdatePerson(selectedNode.id, data)}
              />
              <Separator />
              <Button variant="destructive" onClick={() => onDeletePerson(selectedNode.id)}>
                Supprimer la personne
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit relation dialog */}
      <Dialog open={!!selectedEdge} onOpenChange={(o) => !o && setSelectedEdge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le lien</DialogTitle>
          </DialogHeader>
          {selectedEdge && (
            <div className="space-y-4">
              <RelationSelector
                value={selectedEdge.proximity}
                onChange={(p) => {
                  setRelations((prev) => prev.map((r) => (r.id === selectedEdge.id ? { ...r, proximity: p } : r)));
                }}
              />
              <Separator />
              <Button
                variant="destructive"
                onClick={() => {
                  setRelations((prev) => prev.filter((r) => r.id !== selectedEdge.id));
                  setSelectedEdge(null);
                }}
              >
                Supprimer le lien
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Choose proximity after connecting */}
      <Dialog open={!!pendingConnect} onOpenChange={(o) => !o && setPendingConnect(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Définir la proximité du lien</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RelationSelector value={"moyen"} onChange={() => {}} />
            <div className="flex gap-2">
              <Button onClick={() => commitConnection("fort")}>Fort</Button>
              <Button variant="secondary" onClick={() => commitConnection("moyen")}>Moyen</Button>
              <Button variant="outline" onClick={() => commitConnection("faible")}>Faible</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
