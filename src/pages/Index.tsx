import KnowledgeMap from "@/components/knowledge/KnowledgeMap";
import Seo from "@/components/seo/Seo";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Seo
        title="Carte des Relations | Mapping de Connaissances"
        description="Cartographiez votre réseau, reliez des personnes, ajustez les niveaux de proximité et exportez vos données en Excel."
        canonical="/"
      />

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
