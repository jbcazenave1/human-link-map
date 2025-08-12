import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, go home
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
  }, [navigate]);

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Connexion Google échouée",
        description: error.message,
      });
      setLoading(false);
    }
    // On success, Supabase redirects automatically
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);
    if (error) {
      toast({ variant: "destructive", title: "Inscription échouée", description: error.message });
    } else {
      toast({ title: "Vérifiez votre email", description: "Cliquez sur le lien de confirmation pour finaliser l'inscription." });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ variant: "destructive", title: "Connexion échouée", description: error.message });
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Seo
        title="Connexion | Carte des Relations"
        description="Connectez-vous avec Google ou email pour accéder à votre carte et enregistrer vos données."
        canonical="/auth"
      />

      <main className="container flex-1 flex items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Bienvenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGoogle} disabled={loading} className="w-full">
              Continuer avec Google
            </Button>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button variant="secondary" className="w-full" onClick={handleSignIn} disabled={loading}>
              Se connecter
            </Button>
            <Button className="w-full" onClick={handleSignUp} disabled={loading}>
              Créer un compte
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
