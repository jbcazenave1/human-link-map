import KnowledgeMap from "@/components/knowledge/KnowledgeMap";
import { Helmet } from "react-helmet-async";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>Carte des Relations | Mapping de Connaissances</title>
        <meta name="description" content="Cartographiez votre réseau, reliez des personnes, ajustez les niveaux de proximité et exportez vos données en Excel." />
        <link rel="canonical" href="/" />
      </Helmet>

      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-6">
          <h1 className="text-3xl font-semibold tracking-tight">Carte des relations humaines</h1>
          <p className="text-muted-foreground mt-2">
            Visualisez votre réseau, identifiez les relais d’introduction et priorisez vos démarches.
          </p>
        </div>
      </header>

      <main className="container py-6 flex-1">
        <KnowledgeMap />
      </main>
    </div>
  );
};

export default Index;
