import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, Mail, User as UserIcon } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSession,
  login,
  lookupClient,
  register as registerUser,
  setPassword as submitPasswordSetup,
  startOAuth
} from "@/lib/api";

const mainSiteUrl = "https://santos-games.com";
const MIN_PASSWORD_LENGTH = 8;

type Provider = {
  name: string;
  label: string;
  icon: ReactNode;
};

const providers: Provider[] = [
  { name: "google", label: "Continuar com Google", icon: <GoogleIcon /> },
  { name: "discord", label: "Continuar com Discord", icon: <DiscordIcon /> },
  { name: "steam", label: "Continuar com Steam", icon: <SteamIcon /> }
];

export function AuthApp() {
  const queryClient = useQueryClient();
  const isRegister = window.location.pathname.startsWith("/register");
  const isPasswordSetup = window.location.pathname.startsWith("/set-password");
  const searchParams = new URLSearchParams(window.location.search);
  const provider = searchParams.get("provider");
  const oauthEmail = searchParams.get("email") ?? "";
  const oauthLogin = searchParams.get("login") ?? "";
  const oauthDisplayName = searchParams.get("displayName") ?? "";
  const oauthAvatarUrl = searchParams.get("avatarUrl") ?? "";
  const toast = searchParams.get("toast");
  const clientIdParam = searchParams.get("client_id");
  const redirectUriParam = searchParams.get("redirect_uri");
  const hasClientFlow = Boolean(clientIdParam && redirectUriParam);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState(oauthEmail);
  const [registerLogin, setRegisterLogin] = useState(oauthLogin || oauthEmail.split("@")[0] || "");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [setupPassword, setSetupPasswordValue] = useState("");
  const [setupConfirmPassword, setSetupConfirmPassword] = useState("");
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showSetupConfirm, setShowSetupConfirm] = useState(false);

  const clientLookup = useQuery({
    queryKey: ["client", clientIdParam, redirectUriParam],
    queryFn: () => lookupClient({ clientId: clientIdParam!, redirectUri: redirectUriParam! }),
    enabled: hasClientFlow,
    retry: false
  });
  const clientFlow = useMemo(
    () =>
      clientLookup.data
        ? { clientId: clientLookup.data.clientId, redirectUri: clientLookup.data.redirectUri }
        : undefined,
    [clientLookup.data?.clientId, clientLookup.data?.redirectUri],
  );
  const clientName = clientLookup.data?.name ?? null;
  const clientFlowError = hasClientFlow && clientLookup.isError;

  const [toastMessage, setToastMessage] = useState<string | null>(
    resolveInitialToastMessage(isRegister, isPasswordSetup, provider, toast)
  );

  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    retry: false
  });
  const finalRedirectUri = clientFlow?.redirectUri ?? resolveReturnTo();
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["session"] });
      if (data.redirectUri) {
        window.location.replace(data.redirectUri);
      }
    }
  });
  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["session"] });
      if (data.redirectUri) {
        window.location.replace(data.redirectUri);
      }
    }
  });
  const setPasswordMutation = useMutation({
    mutationFn: submitPasswordSetup,
    onSuccess: (data) => window.location.replace(data.redirectUri ?? finalRedirectUri)
  });
  const user = session.data?.authenticated ? session.data.user : null;
  const needsPasswordSetup = session.data?.needsPasswordSetup ?? false;

  useEffect(() => {
    if (hasClientFlow && clientLookup.isLoading) {
      return;
    }

    if (user && needsPasswordSetup && !isPasswordSetup) {
      const url = new URL("/set-password", window.location.origin);
      url.searchParams.set("returnTo", finalRedirectUri);
      if (clientFlow) {
        url.searchParams.set("client_id", clientFlow.clientId);
        url.searchParams.set("redirect_uri", clientFlow.redirectUri);
      }
      url.searchParams.set("toast", "Sua conta ainda nao possui senha. Defina uma senha para continuar.");
      window.location.replace(url.toString());
      return;
    }

    if (user && !needsPasswordSetup && !isPasswordSetup) {
      window.location.replace(finalRedirectUri);
    }
  }, [
    clientFlow,
    clientLookup.isLoading,
    finalRedirectUri,
    hasClientFlow,
    isPasswordSetup,
    needsPasswordSetup,
    user
  ]);

  useEffect(() => {
    if (isPasswordSetup && !session.isLoading && !user) {
      window.location.replace("/");
    }
  }, [isPasswordSetup, session.isLoading, user]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate({ identifier, password, ...(clientFlow ?? {}) });
  };

  const onIdentifierChange = (event: ChangeEvent<HTMLInputElement>) => {
    setIdentifier(event.currentTarget.value);
  };

  const onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.currentTarget.value);
  };

  const onRegisterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (registerPassword !== registerConfirmPassword) {
      setToastMessage("As senhas nao conferem.");
      return;
    }

    if (!isPasswordAcceptable(registerPassword)) {
      setToastMessage(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    registerMutation.mutate({
      email: registerEmail,
      login: registerLogin,
      password: registerPassword,
      provider: provider ?? undefined,
      displayName: oauthDisplayName || undefined,
      avatarUrl: oauthAvatarUrl || undefined,
      ...(clientFlow ?? {})
    });
  };

  const onRegisterEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRegisterEmail(event.currentTarget.value);
  };

  const onRegisterLoginChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRegisterLogin(event.currentTarget.value);
  };

  const onRegisterPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRegisterPassword(event.currentTarget.value);
  };

  const onRegisterConfirmPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRegisterConfirmPassword(event.currentTarget.value);
  };

  const onSetupPasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (setupPassword !== setupConfirmPassword) {
      setToastMessage("As senhas nao conferem.");
      return;
    }

    if (!isPasswordAcceptable(setupPassword)) {
      setToastMessage(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setPasswordMutation.mutate({
      password: setupPassword,
      ...(clientFlow ?? {})
    });
  };

  const isLoadingShell = session.isLoading || clientLookup.isLoading;
  const headlineWord1 = isPasswordSetup ? "Definir" : isRegister ? "Criar" : "Entrar na";
  const headlineWord2 = isPasswordSetup ? "Senha" : isRegister ? "Conta" : "Arena";
  const subtitle = isPasswordSetup
    ? "Sua conta ainda não possui senha. Defina uma senha para continuar."
    : isRegister
      ? "Finalize seu cadastro com email, usuário e senha."
      : "Inicie sua sessão competitiva";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.62 0.21 22 / 0.06), transparent 70%)"
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[15rem] font-black italic uppercase tracking-tighter text-white/[0.012] md:text-[25rem]"
           style={{ fontFamily: "var(--font-display)" }}>
        Access
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col items-center px-4 py-10 sm:px-6">
        <div className="flex w-full flex-1 flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="group relative w-full max-w-md"
          >
            <div className="absolute -top-4 -left-4 h-8 w-8 border-t border-l border-white/10 transition-colors group-hover:border-primary/40" />
            <div className="absolute -bottom-4 -right-4 h-8 w-8 border-b border-r border-white/10 transition-colors group-hover:border-primary/40" />

            {toastMessage ? (
              <div className="mb-4 border border-success/35 bg-[oklch(0.24_0.04_150)]/40 px-4 py-3 text-sm text-[oklch(0.92_0.10_150)] backdrop-blur-md">
                {toastMessage}
              </div>
            ) : null}

            {clientFlowError ? (
              <div className="mb-4 border border-destructive/45 bg-destructive/10 px-4 py-3 text-sm text-[oklch(0.88_0.10_25)] backdrop-blur-md">
                Aplicação ou redirect_uri inválidos. Volte para o app que te enviou aqui.
              </div>
            ) : null}

            <form
              onSubmit={isRegister ? onRegisterSubmit : isPasswordSetup ? onSetupPasswordSubmit : onSubmit}
              className="relative overflow-hidden border border-white/5 bg-[var(--surface-2)]/85 p-8 shadow-2xl backdrop-blur-md"
            >
              <div className="mb-8 flex justify-center border-b border-white/10 pb-6">
                <img
                  src="/sga-logo.png"
                  alt="Santos Games"
                  className="h-14 w-auto select-none"
                />
              </div>

              <h1 className="mb-2 text-3xl text-center font-black uppercase italic leading-none tracking-tight text-white"
                  style={{ fontFamily: "var(--font-display)" }}>
                {headlineWord1} <span className="text-primary">{headlineWord2}</span>
              </h1>
              <p className="mb-6 text-3 uppercase tracking-[0.2em] text-muted-foreground">
                {subtitle}
              </p>

              {clientName ? (
                <div className="mb-6 flex items-center gap-2 border-l-2 border-primary bg-primary/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  Entrando em {clientName}
                </div>
              ) : null}

              {isLoadingShell || (user && !isPasswordSetup) ? (
                <div className="flex h-[22rem] items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : isPasswordSetup ? (
                <div className="space-y-5">
                  <div className="border border-white/10 bg-[var(--surface-1)] px-4 py-3 text-sm">
                    <p className="font-bold text-white">
                      Sua conta com {resolveProviderLabel(provider ?? "") ?? "OAuth"} ainda não tem senha
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {user
                        ? `Logado como ${oauthDisplayName || oauthLogin || user.email}`
                        : "Defina uma senha para concluir seu cadastro."}
                    </p>
                    {provider ? (
                      <div className="mt-3 flex items-center gap-3 border border-white/10 bg-[var(--surface-2)] px-3 py-2">
                        {oauthAvatarUrl ? (
                          <img src={oauthAvatarUrl} alt="" className="h-9 w-9 border border-white/10 object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center border border-white/10 bg-[var(--surface-3)] text-xs font-bold uppercase text-primary">
                            {resolveProviderLabel(provider)?.slice(0, 1) ?? "O"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">
                            {oauthDisplayName || oauthLogin || user?.email || "Conta OAuth"}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Origem: {resolveProviderLabel(provider)}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <Label htmlFor="setup-password" className="mb-1.5 block text-[10px] font-black uppercase italic tracking-widest text-muted-foreground">
                      Chave de Acesso (Senha)
                    </Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                      <Input
                        id="setup-password"
                        type={showSetupPassword ? "text" : "password"}
                        value={setupPassword}
                        onChange={(event) => setSetupPasswordValue(event.currentTarget.value)}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="h-12 border-white/10 bg-white/5 pl-10 pr-12 text-white transition-all placeholder:text-white/10 focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSetupPassword((current) => !current)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-white"
                        aria-label={showSetupPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showSetupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/80">
                      Mín. {MIN_PASSWORD_LENGTH} caracteres
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="setup-confirm-password" className="mb-1.5 block text-[10px] font-black uppercase italic tracking-widest text-muted-foreground">
                      Confirmar Senha
                    </Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                      <Input
                        id="setup-confirm-password"
                        type={showSetupConfirm ? "text" : "password"}
                        value={setupConfirmPassword}
                        onChange={(event) => setSetupConfirmPassword(event.currentTarget.value)}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="h-12 border-white/10 bg-white/5 pl-10 pr-12 text-white transition-all placeholder:text-white/10 focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSetupConfirm((current) => !current)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-white"
                        aria-label={showSetupConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                      >
                        {showSetupConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {setPasswordMutation.isError ? (
                    <p className="text-sm text-destructive">Não foi possível definir a senha.</p>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={setPasswordMutation.isPending || !setupPassword || !setupConfirmPassword}
                    className="h-12 w-full bg-primary text-sm font-black uppercase italic tracking-[0.2em] text-primary-foreground shadow-[0_0_20px_rgba(248,109,131,0.2)] hover:bg-primary/90 disabled:opacity-60"
                  >
                    {setPasswordMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Definir Senha"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {provider && !isRegister ? (
                    <div className="flex items-center gap-3 border border-white/10 bg-[var(--surface-1)] px-4 py-3 text-sm">
                      {oauthAvatarUrl ? (
                        <img src={oauthAvatarUrl} alt="" className="h-10 w-10 border border-white/10 object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center border border-white/10 bg-[var(--surface-3)] text-xs font-bold uppercase text-primary">
                          {resolveProviderLabel(provider)?.slice(0, 1) ?? "O"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-bold text-white">
                          {oauthDisplayName || oauthLogin || "Conta OAuth"}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Iniciado com {resolveProviderLabel(provider)}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2.5">
                    {providers.map(({ name, label, icon }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() =>
                          startOAuth(name as "google" | "discord" | "steam", {
                            returnTo: finalRedirectUri,
                            entry: isRegister ? "register" : "login",
                            clientId: clientFlow?.clientId,
                            redirectUri: clientFlow?.redirectUri
                          })
                        }
                        className="group relative flex h-12 w-full items-center justify-center gap-3 overflow-hidden border border-white/10 bg-white/5 text-sm font-bold text-white transition-all hover:border-primary/40 hover:bg-white/10"
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                        />
                        <span className="relative flex items-center gap-3">
                          {icon}
                          <span className="uppercase tracking-wider">{label}</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="my-2 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] font-black uppercase italic tracking-[0.3em] text-muted-foreground/80">
                      ou
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  {isRegister ? (
                    <>
                      <div>
                        <Label htmlFor="register-email" className="mb-1.5 block text-10 font-black uppercase tracking-widest text-muted-foreground">
                          Email
                        </Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                          <Input
                            id="register-email"
                            value={registerEmail}
                            onChange={onRegisterEmailChange}
                            autoComplete="email"
                            placeholder="player@sga.gg"
                            className="h-12 border-white/10 bg-white/5 pl-10 text-white transition-all placeholder:text-white/10 focus:border-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="register-login" className="mb-1.5 block text-[10px] font-black uppercase italic tracking-widest text-muted-foreground">
                          Codinome (Usuário)
                        </Label>
                        <div className="relative">
                          <UserIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                          <Input
                            id="register-login"
                            value={registerLogin}
                            onChange={onRegisterLoginChange}
                            autoComplete="username"
                            placeholder="seu.usuario"
                            className="h-12 border-white/10 bg-white/5 pl-10 text-white transition-all placeholder:text-white/10 focus:border-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="register-password" className="mb-1.5 block text-[10px] font-black uppercase italic tracking-widest text-muted-foreground">
                          Chave de Acesso (Senha)
                        </Label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                          <Input
                            id="register-password"
                            type="password"
                            value={registerPassword}
                            onChange={onRegisterPasswordChange}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            className="h-12 border-white/10 bg-white/5 pl-10 text-white transition-all placeholder:text-white/10 focus:border-primary"
                          />
                        </div>
                        <p className="mt-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/80">
                          Mín. {MIN_PASSWORD_LENGTH} caracteres
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="register-confirm-password" className="mb-1.5 block text-[10px] font-black uppercase italic tracking-widest text-muted-foreground">
                          Confirmar Chave
                        </Label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                          <Input
                            id="register-confirm-password"
                            type="password"
                            value={registerConfirmPassword}
                            onChange={onRegisterConfirmPasswordChange}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            className="h-12 border-white/10 bg-white/5 pl-10 text-white transition-all placeholder:text-white/10 focus:border-primary"
                          />
                        </div>
                      </div>

                      {registerMutation.isError ? (
                        <p className="text-sm text-destructive">
                          Não foi possível criar a conta. Verifique email e usuário.
                        </p>
                      ) : null}

                      <Button
                        type="submit"
                        disabled={
                          registerMutation.isPending ||
                          !registerEmail ||
                          !registerLogin ||
                          !registerPassword ||
                          !registerConfirmPassword
                        }
                        className="h-12 w-full bg-primary text-sm font-black uppercase italic tracking-[0.2em] text-primary-foreground shadow-[0_0_20px_rgba(248,109,131,0.2)] hover:bg-primary/90 disabled:opacity-60"
                      >
                        {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Identidade"}
                      </Button>

                      <p className="mt-6 text-center text-[10px] uppercase italic tracking-widest text-muted-foreground">
                        Já tem credenciais?{" "}
                        <a href="/" className="font-black text-primary transition-colors hover:text-white">
                          Acessar
                        </a>
                      </p>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="identifier" className="mb-1.5 block text-2 font-black uppercase tracking-widest text-muted-foreground">
                          Email
                        </Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                          <Input
                            id="identifier"
                            value={identifier}
                            onChange={onIdentifierChange}
                            autoComplete="username"
                            placeholder="player@sga.gg"
                            className="h-12 border-white/10 bg-white/5 pl-10 text-white transition-all placeholder:text-white/10 focus:border-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="password" className="mb-1.5 block text-2 font-black uppercase tracking-widest text-muted-foreground">
                          Senha
                        </Label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                          <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={onPasswordChange}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            className="h-12 border-white/10 bg-white/5 pl-10 text-white transition-all placeholder:text-white/10 focus:border-primary"
                          />
                        </div>
                      </div>

                      {loginMutation.isError ? (
                        <p className="text-sm text-destructive">
                          Credenciais inválidas ou usuário inativo.
                        </p>
                      ) : null}

                      <Button
                        type="submit"
                        disabled={loginMutation.isPending || !identifier || !password}
                        className="h-12 w-full bg-primary text-sm font-black uppercase italic tracking-[0.2em] text-primary-foreground shadow-[0_0_20px_rgba(248,109,131,0.2)] hover:bg-primary/90 disabled:opacity-60"
                      >
                        {loginMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Acessar Sistema"
                        )}
                      </Button>

                      <p className="mt-6 text-center text-[10px] uppercase italic tracking-widest text-muted-foreground">
                        Sem credenciais?{" "}
                        <a href="/register" className="font-black text-primary transition-colors hover:text-white">
                          Criar Identidade
                        </a>
                      </p>
                    </>
                  )}
                </div>
              )}
            </form>
          </motion.div>
        </div>

        <p className="relative z-10 mt-8 text-center text-[10px] uppercase italic tracking-[0.5em] text-muted-foreground/60">
          SGA ・ Santos Games Arena
        </p>
      </div>
    </main>
  );
}

function resolveReturnTo() {
  const fallback = mainSiteUrl;
  const candidate = new URLSearchParams(window.location.search).get("returnTo");

  if (!candidate) {
    return fallback;
  }

  try {
    const url = new URL(candidate, window.location.origin);
    if (url.hostname === "santos-games.com" || url.hostname.endsWith(".santos-games.com")) {
      return url.toString();
    }
  } catch {
    // Ignore invalid candidates.
  }

  return fallback;
}

function isPasswordAcceptable(password: string) {
  return password.trim().length >= MIN_PASSWORD_LENGTH;
}

function resolveInitialToastMessage(
  isRegister: boolean,
  isPasswordSetup: boolean,
  provider: string | null,
  toast: string | null
) {
  if (toast) {
    return toast;
  }

  if (isPasswordSetup) {
    const providerName = resolveProviderLabel(provider ?? "");
    return providerName
      ? `Conta criada com ${providerName}. Defina sua senha para finalizar.`
      : "Sua conta foi criada. Defina sua senha para finalizar.";
  }

  if (!isRegister || !provider) {
    return null;
  }

  const providerName = resolveProviderLabel(provider);
  if (!providerName) {
    return null;
  }

  return `Nenhuma conta vinculada ao ${providerName}. Crie uma conta para continuar.`;
}

function resolveProviderLabel(provider: string) {
  if (provider === "google") {
    return "Google";
  }

  if (provider === "discord") {
    return "Discord";
  }

  if (provider === "steam") {
    return "Steam";
  }

  return null;
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 7 29.5 5 24 5 16.3 5 9.6 9.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43c5.3 0 10.1-2 13.8-5.3l-6.4-5.4c-2 1.4-4.6 2.2-7.4 2.2-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.5 38.6 16.2 43 24 43z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.3l6.4 5.4C41.6 35 43.5 30 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#5865F2" aria-hidden>
      <path d="M20.317 4.369A19.79 19.79 0 0016.558 3a14.6 14.6 0 00-.69 1.418 18.27 18.27 0 00-5.736 0A14.5 14.5 0 009.44 3a19.74 19.74 0 00-3.76 1.369C2.13 9.738 1.205 14.96 1.667 20.106A19.9 19.9 0 007.7 23a14.7 14.7 0 001.27-2.06 12.94 12.94 0 01-2-1c.168-.122.332-.25.49-.378 3.84 1.78 8 1.78 11.79 0 .16.13.323.256.49.378-.638.38-1.31.71-2 1A14.5 14.5 0 0019 23a19.85 19.85 0 006.04-2.894c.55-6-.88-11.18-3.723-15.737zM8.02 16.83c-1.18 0-2.156-1.085-2.156-2.42 0-1.333.955-2.42 2.156-2.42 1.21 0 2.176 1.097 2.156 2.42 0 1.335-.955 2.42-2.156 2.42zm7.96 0c-1.18 0-2.156-1.085-2.156-2.42 0-1.333.955-2.42 2.156-2.42 1.21 0 2.176 1.097 2.156 2.42 0 1.335-.946 2.42-2.156 2.42z" />
    </svg>
  );
}

function SteamIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.6 0 .4 4.9 0 11.2l6.4 2.7c.5-.4 1.2-.6 1.9-.6h.2l2.9-4.2v-.1c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5-2 4.5-4.5 4.5h-.1l-4.1 3v.2c0 1.9-1.5 3.4-3.4 3.4-1.6 0-3-1.2-3.3-2.7L1.4 15.5C2.9 20.4 7 24 12 24c6.6 0 12-5.4 12-12S18.6 0 12 0zM7.5 18.2l-1.5-.6c.3.6.7 1.1 1.4 1.4 1.4.6 3-.1 3.6-1.5.3-.7.3-1.4 0-2.1-.3-.7-.8-1.2-1.5-1.5-.7-.3-1.4-.3-2.1 0l1.5.6c1 .4 1.5 1.6 1.1 2.6-.4 1-1.5 1.5-2.5 1.1zM18 9c0-1.7-1.3-3-3-3s-3 1.3-3 3 1.3 3 3 3 3-1.3 3-3zm-5.2 0c0-1.2 1-2.2 2.2-2.2s2.2 1 2.2 2.2-1 2.2-2.2 2.2-2.2-1-2.2-2.2z" />
    </svg>
  );
}
