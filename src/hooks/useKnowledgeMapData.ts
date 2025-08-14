import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Type the supabase client as any to bypass empty types
const sb: any = supabase;
import { toast } from "@/hooks/use-toast";
import type { Person, Relation, Proximity, PersonCategory } from "@/components/knowledge/KnowledgeMap";


export function useKnowledgeMapData() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Get current user and load data
  const loadData = useCallback(async (currentUser: User) => {
    try {
      console.log("Loading data for user:", currentUser.id);
      
      const [personsResult, relationsResult] = await Promise.all([
        sb
          .from("knowledge_persons")
          .select("*")
          .eq("user_id", currentUser.id),
        sb
          .from("knowledge_relations")
          .select("*")
          .eq("user_id", currentUser.id)
      ]);

      if (personsResult.error) {
        console.error("Error loading persons:", personsResult.error);
        toast({ title: "Erreur", description: "Impossible de charger les personnes" });
      } else {
        console.log("Loaded persons:", personsResult.data?.length || 0);
        const loadedPersons = personsResult.data?.map((row: any): Person => ({
          id: String(row.id),
          firstName: String(row.first_name),
          lastName: String(row.last_name),
          company: row.company ?? undefined,
          comment: row.comment ?? undefined,
          proximity: row.proximity as Proximity,
          categories: (row.categories as PersonCategory[]) ?? [],
          position:
            typeof row.position_x === "number" && typeof row.position_y === "number"
              ? { x: row.position_x, y: row.position_y }
              : undefined,
        })) || [];
        setPersons(loadedPersons);
      }

      if (relationsResult.error) {
        console.error("Error loading relations:", relationsResult.error);
        toast({ title: "Erreur", description: "Impossible de charger les relations" });
      } else {
        console.log("Loaded relations:", relationsResult.data?.length || 0);
        const loadedRelations = relationsResult.data?.map((row: any): Relation => ({
          id: String(row.id),
          sourceId: String(row.source_id),
          targetId: String(row.target_id),
          proximity: row.proximity as Proximity,
        })) || [];
        setRelations(loadedRelations);
      }
    } catch (error) {
      console.error("Error in loadData:", error);
      toast({ title: "Erreur", description: "Erreur lors du chargement des données" });
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await sb.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          setLoading(false);
          return;
        }

        if (session?.user) {
          console.log("User found:", session.user.id);
          setUser(session.user);
          await loadData(session.user);
        } else {
          console.log("No user session found");
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error initializing auth:", error);
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id);
      
      if (session?.user) {
        setUser(session.user);
        if (event === 'SIGNED_IN') {
          await loadData(session.user);
        }
      } else {
        setUser(null);
        setPersons([]);
        setRelations([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadData]);

  const addPerson = useCallback(async (data: Omit<Person, "id">) => {
    if (!user) {
      console.error("No user available for addPerson");
      toast({ title: "Erreur", description: "Utilisateur non connecté" });
      return;
    }
    
    try {
      console.log("Adding person:", data);
      
      const { data: insertedData, error } = await sb
        .from("knowledge_persons")
        .insert({
          user_id: user.id,
          first_name: data.firstName,
          last_name: data.lastName,
          company: data.company ?? null,
          comment: data.comment ?? null,
          proximity: data.proximity,
          position_x: data.position?.x ?? null,
          position_y: data.position?.y ?? null,
          categories: data.categories ?? [],
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding person:", error);
        toast({ title: "Erreur", description: "Impossible d'ajouter la personne" });
        return;
      }

      const newPerson: Person = {
        id: String(insertedData.id),
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        comment: data.comment,
        proximity: data.proximity,
        categories: data.categories ?? [],
        position: data.position,
      };

      setPersons(prev => [...prev, newPerson]);
      toast({ title: "Personne ajoutée", description: `${data.firstName} ${data.lastName}` });
    } catch (error) {
      console.error("Error in addPerson:", error);
      toast({ title: "Erreur", description: "Erreur lors de l'ajout" });
    }
  }, [user]);

  const updatePerson = useCallback(async (id: string, data: Omit<Person, "id">) => {
    if (!user) {
      console.error("No user available for updatePerson");
      toast({ title: "Erreur", description: "Utilisateur non connecté" });
      return;
    }

    try {
      console.log("Updating person:", id, data);
      
      const { error } = await sb
        .from("knowledge_persons")
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          company: data.company ?? null,
          comment: data.comment ?? null,
          proximity: data.proximity,
          categories: data.categories ?? [],
        })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating person:", error);
        toast({ title: "Erreur", description: "Impossible de modifier la personne" });
        return;
      }

      setPersons(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
      toast({ title: "Modifié", description: `${data.firstName} ${data.lastName}` });
    } catch (error) {
      console.error("Error in updatePerson:", error);
      toast({ title: "Erreur", description: "Erreur lors de la modification" });
    }
  }, [user]);

  const deletePerson = useCallback(async (id: string) => {
    if (!user) {
      console.error("No user available for deletePerson");
      toast({ title: "Erreur", description: "Utilisateur non connecté" });
      return;
    }

    try {
      console.log("Deleting person:", id);
      
      const [personResult, relationsResult] = await Promise.all([
        sb
          .from("knowledge_persons")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id),
        sb
          .from("knowledge_relations")
          .delete()
          .or(`source_id.eq.${id},target_id.eq.${id}`)
          .eq("user_id", user.id)
      ]);

      if (personResult.error) {
        console.error("Error deleting person:", personResult.error);
        toast({ title: "Erreur", description: "Impossible de supprimer la personne" });
        return;
      }

      if (relationsResult.error) {
        console.error("Error deleting related relations:", relationsResult.error);
        // Continue anyway, person is deleted
      }

      setPersons(prev => prev.filter(p => p.id !== id));
      setRelations(prev => prev.filter(r => r.sourceId !== id && r.targetId !== id));
      toast({ title: "Supprimé", description: "Personne et liens supprimés" });
    } catch (error) {
      console.error("Error in deletePerson:", error);
      toast({ title: "Erreur", description: "Erreur lors de la suppression" });
    }
  }, [user]);

  const addRelation = useCallback(async (sourceId: string, targetId: string, proximity: Proximity) => {
    if (!user) {
      console.error("No user available for addRelation");
      toast({ title: "Erreur", description: "Utilisateur non connecté" });
      return;
    }

    try {
      console.log("Adding relation:", { sourceId, targetId, proximity });
      
      const { data: insertedData, error } = await sb
        .from("knowledge_relations")
        .insert({
          user_id: user.id,
          source_id: sourceId,
          target_id: targetId,
          proximity: proximity,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding relation:", error);
        toast({ title: "Erreur", description: "Impossible d'ajouter le lien" });
        return;
      }

      const newRelation: Relation = {
        id: String(insertedData.id),
        sourceId,
        targetId,
        proximity,
      };

      setRelations(prev => [...prev, newRelation]);
      toast({ title: "Lien ajouté", description: `Proximité: ${proximity}` });
    } catch (error) {
      console.error("Error in addRelation:", error);
      toast({ title: "Erreur", description: "Erreur lors de l'ajout du lien" });
    }
  }, [user]);

  const updatePersonPosition = useCallback(async (id: string, position: { x: number; y: number }) => {
    if (!user) return;

    try {
      const { error } = await sb
        .from("knowledge_persons")
        .update({ position_x: position.x, position_y: position.y })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating position:", error);
        return;
      }

      setPersons(prev => prev.map(p => p.id === id ? { ...p, position } : p));
    } catch (error) {
      console.error("Error in updatePersonPosition:", error);
    }
  }, [user]);

  return {
    persons,
    relations,
    user,
    loading,
    addPerson,
    updatePerson,
    deletePerson,
    addRelation,
    updatePersonPosition,
    setPersons,
    setRelations,
  };
}