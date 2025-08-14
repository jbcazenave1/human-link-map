-- Remove dangerous public policies that expose all user data
-- These policies allow unrestricted access to personal contact information and network connections

-- Drop public policies for knowledge_persons table
DROP POLICY IF EXISTS "Public select persons" ON public.knowledge_persons;
DROP POLICY IF EXISTS "Public insert persons" ON public.knowledge_persons;
DROP POLICY IF EXISTS "Public update persons" ON public.knowledge_persons;
DROP POLICY IF EXISTS "Public delete persons" ON public.knowledge_persons;

-- Drop public policies for knowledge_relations table
DROP POLICY IF EXISTS "Public select relations" ON public.knowledge_relations;
DROP POLICY IF EXISTS "Public insert relations" ON public.knowledge_relations;
DROP POLICY IF EXISTS "Public update relations" ON public.knowledge_relations;
DROP POLICY IF EXISTS "Public delete relations" ON public.knowledge_relations;

-- Note: User-specific policies (knowledge_persons_*_own and knowledge_relations_*_own) remain intact
-- These ensure users can only access their own data when authenticated