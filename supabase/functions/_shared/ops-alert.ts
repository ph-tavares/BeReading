// supabase/functions/_shared/ops-alert.ts
// BER-39: falhas do quiz e das medalhas eram engolidas — no máximo um
// console.error que some dos logs do Edge Runtime em 24h. Foi assim que o loop
// do quiz ficou quebrado em produção por 3 meses sem ninguém notar (BER-27).
//
// Custo mínimo, como a issue pede: sempre loga (sobrevive à falta de
// configuração), e dispara um webhook (Slack/Discord/ntfy — qualquer um que
// aceite um POST com `{ text }`) quando `OPS_ALERT_WEBHOOK_URL` estiver
// configurada. Sem a env, o alerta ainda existe nos logs — não falha fechado
// para "ninguém sabe".

/**
 * Avisa a operação de uma falha. Nunca lança: uma falha ao alertar não pode
 * derrubar quem estava só tentando reportar outra falha.
 */
export async function notifyOps(context: string, message: string): Promise<void> {
  console.error(`[ops-alert:${context}] ${message}`);

  const webhookUrl = Deno.env.get('OPS_ALERT_WEBHOOK_URL');
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[BeReading:${context}] ${message}` }),
    });
  } catch (err) {
    console.error(`[ops-alert:${context}] falha ao enviar o webhook:`, err);
  }
}
