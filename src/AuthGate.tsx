import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase, callbackUrl } from "./supabase";
import Tempo from "./App";
type Mode = "login" | "signup" | "reset" | "password";
export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(configured),
    [preview, setPreview] = useState(false),
    [mode, setMode] = useState<Mode>("login"),
    [account, setAccount] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      setSession(s);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setPassword("");
      if (event === "PASSWORD_RECOVERY") {
        setMode("password");
        setAccount(true);
      }
      if (event === "SIGNED_OUT") {
        setAccount(false);
        setMode("login");
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          setSession(data.session);
          setLoading(false);
          if (error) setFeedback("会话恢复失败，请重新登录");
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setFeedback("无法连接认证服务，请重试");
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setFeedback("");
    try {
      let error;
      if (mode === "login")
        ({ error } = await supabase.auth.signInWithPassword({
          email,
          password,
        }));
      else if (mode === "signup") {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl() },
        });
        error = result.error;
        if (!error && !result.data.session)
          setFeedback("请查收确认邮件，验证后即可登录。");
      } else if (mode === "reset") {
        ({ error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: callbackUrl(),
        }));
        if (!error)
          setFeedback("如果该邮箱已注册，重置邮件将发送到你的收件箱。");
      } else {
        ({ error } = await supabase.auth.updateUser({ password }));
        if (!error) {
          setFeedback("密码已更新");
          setPassword("");
          setAccount(false);
          setMode("login");
        }
      }
      if (error) throw error;
    } catch (e: unknown) {
      setFeedback(e instanceof Error ? e.message : "操作失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) setFeedback(error.message);
    setBusy(false);
  }
  if (loading)
    return (
      <main className="auth-shell">
        <div className="auth-card" role="status">
          正在恢复登录状态…
        </div>
      </main>
    );
  if (preview)
    return (
      <Tempo
        key="preview"
        user={null}
        preview
        onAccount={() => setPreview(false)}
        onExitPreview={() => setPreview(false)}
      />
    );
  if (session && !account)
    return (
      <Tempo
        key={session.user.id}
        user={session.user}
        onAccount={() => {
          setAccount(true);
          setMode("password");
          setFeedback("");
          setPassword("");
        }}
        onExitPreview={() => {}}
      />
    );
  if (!configured)
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <a className="auth-brand" href="#/calendar">
            Tempo<span>·</span>
          </a>
          <h1>先连接你的云端空间</h1>
          <p>前端已准备好。配置 Supabase 后，即可使用真实账户和跨设备保存。</p>
          <ol>
            <li>创建 Supabase 项目，运行随附的 SQL 迁移。</li>
            <li>在 .env.local 中填写项目 URL 和 public publishable key。</li>
            <li>重新启动本地预览或重新构建 GitHub Pages。</li>
          </ol>
          <p className="auth-note">
            尚未配置云端。这里不会创建模拟账户，也不会把任务保存到浏览器。
          </p>
          <button className="primary" onClick={() => setPreview(true)}>
            查看界面示例
          </button>
          <small>示例仅用于查看交互，退出后清空，不能保存。</small>
        </section>
      </main>
    );
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a className="auth-brand" href="#/calendar">
          Tempo<span>·</span>
        </a>
        <h1>
          {mode === "login"
            ? "回到自己的节奏"
            : mode === "signup"
              ? "开启你的学习空间"
              : mode === "reset"
                ? "找回你的账户"
                : "账户与密码"}
        </h1>
        <p>
          {session
            ? session.user.email
            : "任务、日历与学习计划，一个从容的工作空间。"}
        </p>
        {!session && (
          <div className="auth-tabs">
            <button
              onClick={() => {
                setMode("login");
                setFeedback("");
              }}
              className={mode === "login" ? "selected" : ""}
            >
              登录
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setFeedback("");
              }}
              className={mode === "signup" ? "selected" : ""}
            >
              注册
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          {mode !== "password" && (
            <label>
              电子邮箱
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              {mode === "password" ? "新密码" : "密码"}
              <input
                type="password"
                required
                minLength={mode === "login" ? 1 : 8}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode !== "login" && (
                <small>至少 8 位字符，同时遵循项目的密码要求。</small>
              )}
            </label>
          )}
          {feedback && (
            <p className="auth-feedback" role="status">
              {feedback}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "请稍候…"
              : mode === "login"
                ? "登录"
                : mode === "signup"
                  ? "创建账户"
                  : mode === "reset"
                    ? "发送重置邮件"
                    : "更新密码"}
          </button>
        </form>
        {session ? (
          <div className="auth-bottom">
            <button onClick={() => setAccount(false)}>返回工作空间</button>
            <button disabled={busy} onClick={signOut}>
              退出登录
            </button>
          </div>
        ) : (
          <div className="auth-bottom">
            <button
              onClick={() => {
                setMode(mode === "reset" ? "login" : "reset");
                setFeedback("");
              }}
            >
              {mode === "reset" ? "返回登录" : "忘记密码？"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
