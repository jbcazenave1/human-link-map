import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

export type Proximity = "fort" | "moyen" | "faible";

export type PersonCategory =
  | "Partenaire"
  | "Investisseur"
  | "Autre"
  | "Organisme de formation"
  | "Advisor";

export const allCategories: PersonCategory[] = [
  "Partenaire",
  "Investisseur",
  "Autre",
  "Organisme de formation",
  "Advisor",
];

export interface Person {
  id: string; // uuid
  first_name: string;
  last_name: string;
  company?: string | null;
  comment?: string | null;
  proximity: Proximity;
  position_x?: number | null;
  position_y?: number | null;
  categories?: PersonCategory[] | null;
  created_at?: string;
  updated_at?: string;
  user_id: string;
}

export interface Relation {
  id: string; // uuid
  source_id: string;
  target_id: string;
  proximity: Proximity;
  created_at?: string;
  updated_at?: string;
  user_id: string;
}

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

// --- SYNCHRO SUPABASE ---

async function fetchPersons(userId: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from('knowledge_persons')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    toast({ variant: "destructive", title: "Erreur Supabase", description: error.message });
    return [];
  }
  return (data ?? []) as Person[];
}

async function fetchRelations(userId: string): Promise<Relation[]> {
  const { data, error } = await supabase
    .from('knowledge_relations')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    toast({ variant: "destructive", title: "Erreur Supabase", description: error.message });
    return [];
  }
  return (data ?? []) as Relation[];
}

async function savePersons(persons: Person[], userId: string) {
  // Efface toutes les personnes de cet utilisateur puis insère la nouvelle liste
  await supabase.from('knowledge_persons').delete().eq('user_id', userId);
  if (persons.length === 0) return;
  const { error } = await supabase.from('knowledge_persons').insert(persons.map(p => ({ ...p, user_id: userId })));
  if (error) {
    toast({ variant: "destructive", title: "Erreur Supabase", description: error.message });
  }
}

async function saveRelations(relations: Relation[], userId: string) {
  await supabase.from('knowledge_relations').delete().eq('user_id', userId);
  if (relations.length === 0) return;
  const { error } = await supabase.from('knowledge_relations').insert(relations.map(r => ({ ...r, user_id: userId })));
  if (error) {
    toast({ variant: "destructive", title: "Erreur Supabase", description: error.message });
  }
}

// --- FIN SYNCHRO SUPABASE ---

const KnowledgeMap = () => {
  const [persons, setPersons] = useState<Person[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Au montage : récupérer l'utilisateur et charger ses données
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        toast({ variant: "destructive", title: "Non connecté", description: error?.message || "Veuillez vous connecter." });
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const [fetchedPersons, fetchedRelations] = await Promise.all([
        fetchPersons(user.id),
        fetchRelations(user.id)
      ]);
      if (!isMounted) return;
      setPersons(fetchedPersons);
      setRelations(fetchedRelations);
      setLoading(false);
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  // Sauvegarder sur Supabase à chaque changement de persons ou relations
  useEffect(() => {
    if (!userId) return;
    // On évite de sauvegarder au premier chargement (déjà fait)
    if (loading) return;
    savePersons(persons, userId);
  }, [persons, userId, loading]);

  useEffect(() => {
    if (!userId) return;
    if (loading) return;
    saveRelations(relations, userId);
  }, [relations, userId, loading]);

  // --- LOGIQUE EXISTANTE (simplifiée pour l’exemple) ---

  // Ici tu dois adapter tous les endroits où tu modifiais persons/relations,
  // pour que ça mette à jour le state (setPersons/setRelations)
  // Le reste de ta logique UI/ReactFlow peut rester identique
  // ... (ton code de gestion d'ajout/modification/suppression de personnes/relations)

  if (loading) {
    return <div>Chargement des données...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ... ton header ... */}
      <main className="container py-6 flex-1">
        {/* Ton composant ReactFlow, les boutons, etc. */}
        {/* Utilise persons et relations du state */}
        {/* ... */}
      </main>
    </div>
  );
};

export default KnowledgeMap;