import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSession,
  login,
  register as registerUser,
  setPassword as submitPasswordSetup,
  startOAuth
} from "@/lib/api";

const mainSiteUrl = "https://santos-games.com";
const allowedReturnToHosts = new Set(["santos-games.com", "www.santos-games.com"]);

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
  const [toastMessage, setToastMessage] = useState<string | null>(
    resolveInitialToastMessage(isRegister, isPasswordSetup, provider, toast)
  );
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

  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    retry: false
  });
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] })
  });
  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] })
  });
  const setPasswordMutation = useMutation({
    mutationFn: submitPasswordSetup,
    onSuccess: () => window.location.replace(returnTo)
  });
  const user = session.data?.authenticated ? session.data.user : null;
  const needsPasswordSetup = session.data?.needsPasswordSetup ?? false;
  const returnTo = resolveReturnTo();

  useEffect(() => {
    if (user && needsPasswordSetup && !isPasswordSetup) {
      const url = new URL("/set-password", window.location.origin);
      url.searchParams.set("returnTo", returnTo);
      url.searchParams.set("toast", "Sua conta ainda nao possui senha. Defina uma senha para continuar.");
      window.location.replace(url.toString());
      return;
    }

    if (user && !needsPasswordSetup && !isPasswordSetup) {
      window.location.replace(returnTo);
    }
  }, [isPasswordSetup, needsPasswordSetup, returnTo, user]);

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
    loginMutation.mutate({ identifier, password });
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

    registerMutation.mutate({
      email: registerEmail,
      login: registerLogin,
      password: registerPassword,
      provider: provider ?? undefined,
      displayName: oauthDisplayName || undefined,
      avatarUrl: oauthAvatarUrl || undefined
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

    setPasswordMutation.mutate({
      password: setupPassword
    });
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#150707] text-[#f7f1ef]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(167, 0, 18, 0.28) 0, rgba(167, 0, 18, 0.14) 18%, rgba(21, 7, 7, 0) 55%), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 48px 48px, 48px 48px",
          backgroundPosition: "center, center, center"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow:
            "inset 0 0 160px rgba(0, 0, 0, 0.55), inset 0 0 240px rgba(190, 10, 30, 0.15)"
        }}
      />

      <div className="relative z-10 flex min-h-dvh flex-col items-center px-4 py-6 sm:px-6">
        <div className="flex w-full flex-1 flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="w-full max-w-[440px]"
          >
            {toastMessage ? (
              <div className="mb-4 rounded-md border border-[#29c36a]/35 bg-[#11261a]/95 px-4 py-3 text-sm text-[#d8ffe7] shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                {toastMessage}
              </div>
            ) : null}

            <div className="mb-8 flex justify-center">
              <img
                src="/sga-logo.png"
                alt="Santos Games Arena"
                className="h-[72px] w-auto select-none drop-shadow-[0_0_24px_rgba(255,255,255,0.22)] sm:h-[80px]"
              />
            </div>

            <Card
              className="relative overflow-hidden rounded-[14px] border border-white/10 bg-[#2a1212]/80 px-6 py-8 text-[#f5e9e6] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_0_1px_rgba(0,0,0,0.5),0_20px_80px_rgba(0,0,0,0.45),0_0_60px_rgba(180,0,20,0.28)] backdrop-blur-xl sm:px-8"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#ff2642] to-transparent"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[14px]"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px rgba(255,255,255,0.03), inset 0 0 42px rgba(255, 18, 50, 0.07)"
                }}
              />

              <div className="relative">
                <header className="text-center">
                  <h1 className="text-[1.65rem] font-bold tracking-tight text-[#faf4f2] sm:text-[1.75rem]">
                    {isRegister ? (
                      <>Crie sua <span className="text-[#ff243f]">Conta</span></>
                    ) : (
                      <>Entre na <span className="text-[#ff243f]">Arena</span></>
                    )}
                  </h1>
                  <p className="mt-2 text-sm text-[#bca7a3]">
                    {isPasswordSetup
                      ? "Sua conta ainda nao possui senha. Defina uma senha para continuar."
                      : isRegister
                        ? "Finalize seu cadastro com email, usuario e senha."
                        : "Acesse sua conta com um provedor ou email."}
                  </p>
                </header>

                {session.isLoading ? (
                  <div className="flex h-[26rem] items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[#ff243f]" />
                  </div>
                ) : isPasswordSetup ? (
                  <div className="mt-8 space-y-5">
                    <div className="rounded-md border border-white/8 bg-[#341515] px-4 py-3 text-sm text-[#f3dbd6]">
                      <p className="font-semibold text-[#fff2ef]">
                        Sua conta com {resolveProviderLabel(provider ?? "") ?? "OAuth"} ainda nao tem senha
                      </p>
                      <p className="mt-1 text-[#c7aba5]">
                        {user
                          ? `Logado como ${oauthDisplayName || oauthLogin || user.email}`
                          : "Use uma senha para concluir seu cadastro."}
                      </p>
                    </div>

                    <form className="space-y-4" onSubmit={onSetupPasswordSubmit}>
                      <div className="space-y-2">
                        <Label
                          htmlFor="setup-password"
                          className="text-[0.68rem] uppercase tracking-[0.18em] text-[#b8928c]"
                        >
                          Senha
                        </Label>
                        <div className="relative">
                          <Input
                            id="setup-password"
                            type={showSetupPassword ? "text" : "password"}
                            value={setupPassword}
                            onChange={(event) => setSetupPasswordValue(event.currentTarget.value)}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            className="h-12 pr-12 border-white/8 bg-[#3d2323] text-[#f9efed] placeholder:text-[#b89e98]/45 focus-visible:border-[#ff334f]/60 focus-visible:ring-[#ff334f]/25"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSetupPassword((current) => !current)}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-[#c89a94] transition-colors hover:text-[#fff2ef]"
                            aria-label={showSetupPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showSetupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="setup-confirm-password"
                          className="text-[0.68rem] uppercase tracking-[0.18em] text-[#b8928c]"
                        >
                          Confirmar senha
                        </Label>
                        <div className="relative">
                          <Input
                            id="setup-confirm-password"
                            type={showSetupConfirm ? "text" : "password"}
                            value={setupConfirmPassword}
                            onChange={(event) => setSetupConfirmPassword(event.currentTarget.value)}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            className="h-12 pr-12 border-white/8 bg-[#3d2323] text-[#f9efed] placeholder:text-[#b89e98]/45 focus-visible:border-[#ff334f]/60 focus-visible:ring-[#ff334f]/25"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSetupConfirm((current) => !current)}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-[#c89a94] transition-colors hover:text-[#fff2ef]"
                            aria-label={showSetupConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                          >
                            {showSetupConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {setPasswordMutation.isError ? (
                        <p className="text-sm text-[#ff5b6f]">
                          Nao foi possivel definir a senha.
                        </p>
                      ) : null}

                      <Button
                        type="submit"
                        disabled={
                          setPasswordMutation.isPending ||
                          !setupPassword ||
                          !setupConfirmPassword
                        }
                        className="h-12 w-full rounded-md bg-[#ff243f] text-[0.95rem] font-bold uppercase tracking-[0.14em] text-white shadow-[0_10px_28px_-10px_rgba(255,36,63,0.95)] transition-transform duration-200 hover:-translate-y-px hover:bg-[#ff3a52]"
                      >
                        {setPasswordMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Definir senha"
                        )}
                      </Button>
                    </form>
                  </div>
                ) : user ? (
                  <div className="flex h-[26rem] items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[#ff243f]" />
                  </div>
                ) : isRegister ? (
                  <>
                    <div className="mt-8 space-y-3">
                      {providers.map(({ name, label, icon }) => (
                        <Button
                          key={name}
                          type="button"
                          variant="outline"
                          className="group relative h-12 w-full justify-center overflow-hidden rounded-md border border-white/8 bg-[#351b1b] text-[0.95rem] font-medium text-[#f6eeeb] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition-all duration-200 hover:-translate-y-px hover:border-[#ff334f]/45 hover:bg-[#3a1e1e]"
                          onClick={() =>
                            startOAuth(
                              name as "google" | "discord" | "steam",
                              returnTo,
                              isRegister ? "register" : "login"
                            )
                          }
                        >
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                          />
                          <span className="relative flex items-center gap-3">
                            {icon}
                            <span>{label}</span>
                          </span>
                        </Button>
                      ))}
                    </div>

                    <div className="my-6 flex items-center gap-4">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-[10px] uppercase tracking-[0.3em] text-[#8f7670]">
                        ou
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <form className="space-y-4" onSubmit={onRegisterSubmit}>
                      <div className="space-y-2">
                        <Label
                          htmlFor="register-email"
                          className="text-[0.68rem] uppercase tracking-[0.18em] text-[#b8928c]"
                        >
                          Email
                        </Label>
                        <Input
                          id="register-email"
                          value={registerEmail}
                          onChange={onRegisterEmailChange}
                          autoComplete="email"
                          placeholder="voce@exemplo.com"
                          className="h-12 border-white/8 bg-[#3d2323] text-[#f9efed] placeholder:text-[#b89e98]/45 focus-visible:border-[#ff334f]/60 focus-visible:ring-[#ff334f]/25"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="register-login"
                          className="text-[0.68rem] uppercase tracking-[0.18em] text-[#b8928c]"
                        >
                          Usuario
                        </Label>
                        <Input
                          id="register-login"
                          value={registerLogin}
                          onChange={onRegisterLoginChange}
                          autoComplete="username"
                          placeholder="seu.usuario"
                          className="h-12 border-white/8 bg-[#3d2323] text-[#f9efed] placeholder:text-[#b89e98]/45 focus-visible:border-[#ff334f]/60 focus-visible:ring-[#ff334f]/25"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="register-password"
                          className="text-[0.68rem] uppercase tracking-[0.18em] text-[#b8928c]"
                        >
                          Senha
                        </Label>
                        <Input
                          id="register-password"
                          type="password"
                          value={registerPassword}
                          onChange={onRegisterPasswordChange}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className="h-12 border-white/8 bg-[#3d2323] text-[#f9efed] placeholder:text-[#b89e98]/45 focus-visible:border-[#ff334f]/60 focus-visible:ring-[#ff334f]/25"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="register-confirm-password"
                          className="text-[0.68rem] uppercase tracking-[0.18em] text-[#b8928c]"
                        >
                          Confirmar senha
                        </Label>
                        <Input
                          id="register-confirm-password"
                          type="password"
                          value={registerConfirmPassword}
                          onChange={onRegisterConfirmPasswordChange}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className="h-12 border-white/8 bg-[#3d2323] text-[#f9efed] placeholder:text-[#b89e98]/45 focus-visible:border-[#ff334f]/60 focus-visible:ring-[#ff334f]/25"
                        />
                      </div>

                      {registerMutation.isError ? (
                        <p className="text-sm text-[#ff5b6f]">
                          Nao foi possivel criar a conta. Verifique email e usuario.
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
                        className="h-12 w-full rounded-md bg-[#ff243f] text-[0.95rem] font-bold uppercase tracking-[0.14em] text-white shadow-[0_10px_28px_-10px_rgba(255,36,63,0.95)] transition-transform duration-200 hover:-translate-y-px hover:bg-[#ff3a52]"
                      >
                        {registerMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Criar conta"
                        )}
                      </Button>
                    </form>

                    <p className="mt-8 text-center text-sm text-[#9f8984]">
                      Já tem conta?{" "}
                      <a href="/" className="font-semibold text-[#ff243f] hover:underline">
                        Entrar
                      </a>
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-8 space-y-3">
                      {providers.map(({ name, label, icon }) => (
                        <Button
                          key={name}
                          type="button"
                          variant="outline"
                          className="group relative h-12 w-full justify-center overflow-hidden rounded-md border border-white/8 bg-[#351b1b] text-[0.95rem] font-medium text-[#f6eeeb] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition-all duration-200 hover:-translate-y-px hover:border-[#ff334f]/45 hover:bg-[#3a1e1e]"
                          onClick={() =>
                            startOAuth(
                              name as "google" | "discord" | "steam",
                              returnTo,
                              isRegister ? "register" : "login"
                            )
                          }
                        >
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                          />
                          <span className="relative flex items-center gap-3">
                            {icon}
                            <span>{label}</span>
                          </span>
                        </Button>
                      ))}
                    </div>

                    <div className="my-6 flex items-center gap-4">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-[10px] uppercase tracking-[0.3em] text-[#8f7670]">
                        ou
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <form className="space-y-4" onSubmit={onSubmit}>
                      <div className="space-y-2">
                        <Label
                          htmlFor="identifier"
                          className="text-[0.68rem] uppercase tracking-[0.18em] text-[#b8928c]"
                        >
                          Email
                        </Label>
                        <Input
                          id="identifier"
                          value={identifier}
                          onChange={onIdentifierChange}
                          autoComplete="username"
                          placeholder="voce@exemplo.com"
                          className="h-12 border-white/8 bg-[#3d2323] text-[#f9efed] placeholder:text-[#b89e98]/45 focus-visible:border-[#ff334f]/60 focus-visible:ring-[#ff334f]/25"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="password"
                          className="text-[0.68rem] uppercase tracking-[0.18em] text-[#b8928c]"
                        >
                          Senha
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={onPasswordChange}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="h-12 border-white/8 bg-[#3d2323] text-[#f9efed] placeholder:text-[#b89e98]/45 focus-visible:border-[#ff334f]/60 focus-visible:ring-[#ff334f]/25"
                        />
                      </div>

                      {loginMutation.isError ? (
                        <p className="text-sm text-[#ff5b6f]">
                          Credenciais invalidas ou usuario inativo.
                        </p>
                      ) : null}

                      <Button
                        type="submit"
                        disabled={loginMutation.isPending || !identifier || !password}
                        className="h-12 w-full rounded-md bg-[#ff243f] text-[0.95rem] font-bold uppercase tracking-[0.14em] text-white shadow-[0_10px_28px_-10px_rgba(255,36,63,0.95)] transition-transform duration-200 hover:-translate-y-px hover:bg-[#ff3a52]"
                      >
                        {loginMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Entrar"
                        )}
                      </Button>

                      <div className="text-center">
                        <a
                          href="#"
                          className="text-xs font-medium text-[#ff243f] transition-colors hover:text-[#ff5167]"
                        >
                          Esqueceu a senha?
                        </a>
                      </div>
                    </form>

                    <p className="mt-8 text-center text-sm text-[#9f8984]">
                      Não tem uma conta?{" "}
                      <a href="/register" className="font-semibold text-[#ff243f] hover:underline">
                        Cadastre-se
                      </a>
                    </p>

                    <p className="mt-4 text-center text-[11px] leading-5 text-[#8f7670]">
                      Ao continuar, você concorda com nossos{" "}
                      <a href="#" className="text-[#ff243f] hover:underline">
                        Termos
                      </a>{" "}
                      e{" "}
                      <a href="#" className="text-[#ff243f] hover:underline">
                        Política de Privacidade
                      </a>
                      .
                    </p>
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        <p className="relative z-10 mt-8 text-center text-[11px] uppercase tracking-[0.5em] text-[#9c847e]">
          SGA ・ Santos Games Arena
        </p>
      </div>
    </main>
  );
}

function resolveReturnTo() {
  const fallback = mainSiteUrl;

  const candidates = [
    new URLSearchParams(window.location.search).get("returnTo"),
    document.referrer
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      const url = new URL(candidate, window.location.origin);

      if (allowedReturnToHosts.has(url.hostname)) {
        return url.toString();
      }
    } catch {
      // Ignore invalid candidates and fall back below.
    }
  }

  return fallback;
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
