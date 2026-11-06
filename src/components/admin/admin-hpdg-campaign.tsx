"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminHpdgRelease } from "@/lib/hpdg/postgres";
import type { CampaignView } from "@/lib/hpdg/update-campaign";

const field = "w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm";
const statuses: Record<string, string> = {
  pending: "Ожидает", sending: "Отправка начата — при сбое проверь Resend", accepted: "Принято Resend",
  delivered: "Доставлено", rejected: "Запрос отклонён — можно повторить", failed: "Ошибка доставки", unknown: "Результат неизвестен — проверь Resend",
  skipped: "Пропущен", bounced: "Не доставлено (bounce)", complained: "Жалоба", suppressed: "Заблокировано Resend", canceled: "Отменено",
};

async function request(body: Record<string, unknown>): Promise<CampaignView> {
  const response = await fetch("/api/admin/hpdg/campaigns", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Не удалось выполнить действие.");
  return data;
}

function CampaignEditor({ release }: { release: AdminHpdgRelease }) {
  const [view, setView] = useState<CampaignView | null>(null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const campaign = view?.campaign;
  const pending = campaign?.recipients.filter((r) => ["pending", "rejected"].includes(r.status)).length ?? 0;

  async function load() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/hpdg/campaigns?releaseId=${release.id}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить рассылку.");
      const next = data as CampaignView;
      setView(next); setSubject(next.campaign?.subject ?? next.draft.subject); setText(next.campaign?.text ?? next.draft.text);
      setTestEmail(next.campaign?.testEmail ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка."); }
    finally { setBusy(false); }
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await request({ action, releaseId: release.id, ...extra });
      setView(next);
      if (action === "prepare") { setSubject(next.campaign!.subject); setText(next.campaign!.text); }
      if (action === "test") setNotice("Тестовое письмо принято Resend. Открой почту и проверь текст и ссылки, затем подтверди получение ниже.");
      if (action === "send") setNotice("Журнал обновлён. Принято Resend означает, что сервис принял письмо; доставка проверяется отдельно.");
      if (action === "refresh") setNotice("Статусы доставки обновлены из Resend.");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка. Обнови журнал перед повтором."); }
    finally { setBusy(false); }
  }

  return (
    <section className="case-panel space-y-4 p-6">
      <div>
        <h2 className="font-sans text-3xl uppercase tracking-[0.06em]">Письмо об обновлении</h2>
        <p className="mt-2 text-sm">Текущий релиз: <strong>{release.version}</strong>. Одно письмо на email за релиз, даже если покупатель делал донат или покупал повторно.</p>
        <p className="mt-2 text-xs text-[var(--color-paper-400)]">Получатели — активные покупатели Stripe. Ручные и тестовые ключи исключены. Публикация релиза сама письма не отправляет.</p>
      </div>
      <Button type="button" variant="ghost" disabled={busy} onClick={load}>{view ? "Обновить журнал" : "Открыть текст и получателей"}</Button>
      {view ? (
        <div className="space-y-4">
          <label className="block space-y-1"><span>Тема письма</span><input className={field} maxLength={200} value={subject} disabled={Boolean(campaign) || busy} onChange={(e) => setSubject(e.target.value)} /></label>
          <label className="block space-y-1"><span>Текст письма (предпросмотр)</span><textarea className={`${field} min-h-80`} rows={16} maxLength={12000} value={text} disabled={Boolean(campaign) || busy} onChange={(e) => setText(e.target.value)} /></label>
          {!campaign ? (
            <>
              <p className="text-sm">Получателей: {view.eligibleEmails.length}. {view.eligibleEmails.join(", ")}</p>
              <p className="text-xs text-[var(--color-paper-400)]">После подготовки текст и список фиксируются для этого релиза, чтобы повторы не создавали другие письма.</p>
              <Button type="button" disabled={busy || !subject.trim() || text.trim().length < 20 || !view.eligibleEmails.length} onClick={() => act("prepare", { subject, text })}>Подготовить рассылку</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--color-paper-400)]">Рассылка: {campaign.id} · {campaign.recipients.length} адресов. Текст зафиксирован.</p>
              {!campaign.testConfirmedAt ? (
                <div className="space-y-3 border border-[var(--color-line)] p-4">
                  <label className="block space-y-1"><span>Твой email для теста</span><input type="email" autoComplete="email" className={field} value={testEmail} disabled={busy} onChange={(e) => setTestEmail(e.target.value)} /></label>
                  <Button type="button" disabled={busy || !testEmail.trim()} onClick={() => act("test", { email: testEmail })}>Отправить тест на свой email</Button>
                  {campaign.testMessageId ? (
                    <div className="space-y-2">
                      <p className="text-sm">Тест отправлен на {campaign.testEmail}. Подтверждай только после фактического получения.</p>
                      <Button type="button" variant="ghost" disabled={busy} onClick={() => act("confirm-test", { messageId: campaign.testMessageId })}>Я получил и проверил тестовое письмо</Button>
                    </div>
                  ) : null}
                </div>
              ) : <p className="text-sm">Получение теста на {campaign.testEmail} подтверждено.</p>}
              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={busy || !campaign.testConfirmedAt || !pending || !view.isCurrent} onClick={() => {
                  if (window.confirm(`Отправить уведомление ${release.version} на ${Math.min(pending, 5)} адресов? Уже принятые письма повторяться не будут.`)) void act("send");
                }}>{busy ? "Выполняю…" : pending ? `Отправить покупателям (${Math.min(pending, 5)})` : "Нет ожидающих отправки"}</Button>
                <Button type="button" variant="ghost" disabled={busy || !campaign.recipients.some((r) => r.status === "accepted")} onClick={() => act("refresh")}>Проверить доставку</Button>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left text-xs [&_td]:p-2 [&_th]:p-2">
                  <caption className="text-left text-sm">Результат по каждому получателю</caption>
                  <thead><tr><th scope="col">Email</th><th scope="col">Статус</th><th scope="col">ID письма Resend</th></tr></thead>
                  <tbody>{campaign.recipients.map((r) => <tr key={r.id} className="border-t border-[var(--color-line)]"><td>{r.email}</td><td>{statuses[r.status] ?? r.status}{r.error ? <p>{r.error}</p> : null}</td><td>{r.messageId ?? "—"}</td></tr>)}</tbody>
                </table>
              </div>
              <p className="text-xs text-[var(--color-paper-400)]">При неизвестном результате или прерванной отправке автоматического повтора нет: сначала проверь письмо в Resend. Уже принятые, доставленные и отклонённые адресатом письма повторно не отправляются.</p>
            </>
          )}
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-[var(--color-alert)]">{error}</p> : null}
      {notice ? <p role="status" className="text-sm">{notice}</p> : null}
    </section>
  );
}

export function AdminHpdgCampaign({ releases }: { releases: AdminHpdgRelease[] }) {
  const current = releases.find((r) => r.isCurrent);
  return current ? <CampaignEditor key={current.id} release={current} /> : null;
}
