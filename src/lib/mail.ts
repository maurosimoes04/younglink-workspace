import "server-only";
import nodemailer from "nodemailer";

const BRAND = "#1e3a8a";
const BRAND_DEEP = "#172054";
const BG = "#f5f5f4";
const BORDER = "#e7e5e4";
const MUTED = "#78716c";
const TEXT = "#111827";
const LOGO_URL = "https://younglink.net/logo_branco.png";

export const appUrl = (req: Request) => process.env.APP_URL || new URL(req.url).origin;

export function isMailConfigured() {
  return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  if (!isMailConfigured()) return false;
  try {
    await getTransporter().sendMail({
      from: `"Young-Link" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return true;
  } catch (e) {
    console.error("Falha ao enviar email:", (e as Error).message);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const para = (t: string, muted = false) =>
  `<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${muted ? MUTED : TEXT};">${t}</p>`;

function layout(o: { subject: string; preheader: string; eyebrow: string; title: string; intro: string[]; cta: string; link: string; notes: string[]; footnote: string }) {
  return `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${o.subject}</title></head>
<body style="margin:0;padding:0;background-color:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${o.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};padding:24px 0;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="background-color:${BRAND};background-image:linear-gradient(135deg,${BRAND} 0%,${BRAND_DEEP} 100%);border-radius:24px 24px 0 0;padding:28px 28px 24px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle" style="width:120px;"><img src="${LOGO_URL}" alt="Young-Link" width="110" height="62" style="display:block;border:0;"></td>
    <td valign="middle" style="padding-left:14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#ffffff;letter-spacing:.24em;text-transform:uppercase;">${o.eyebrow}</td>
  </tr></table>
  <div style="margin-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:800;line-height:1.2;color:#ffffff;letter-spacing:-.02em;">${o.title}</div>
</td></tr>
<tr><td style="background-color:#ffffff;padding:28px;border:1px solid ${BORDER};border-top:none;border-radius:0 0 24px 24px;">
  ${o.intro.map((t) => para(t)).join("\n  ")}
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;"><tr>
    <td style="border-radius:12px;background-color:${BRAND};"><a href="${esc(o.link)}" style="display:inline-block;padding:13px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${o.cta}</a></td>
  </tr></table>
  ${o.notes.map((t) => para(t, true)).join("\n  ")}
  ${para(`Se o botão não funcionar, copia este endereço para o browser:<br><a href="${esc(o.link)}" style="color:${BRAND};word-break:break-all;">${esc(o.link)}</a>`, true)}
  <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};font-style:italic;">${o.footnote}</p>
</td></tr>
<tr><td style="padding:20px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};">
  <div style="font-weight:700;color:${TEXT};">Associação Young-Link</div><div style="margin-top:4px;">Liga-te. Participa. Transforma.</div>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

export function inviteEmail({ name, email, inviter, link, days }: { name: string; email: string; inviter: string; link: string; days: number }) {
  const subject = "Convite para o espaço de trabalho Young-Link";
  const html = layout({
    subject,
    preheader: `${esc(inviter)} convidou-te para o espaço de trabalho da Young-Link.`,
    eyebrow: "Convite",
    title: "Bem-vindo ao espaço de trabalho",
    intro: [
      `Olá ${esc(name.split(" ")[0])},`,
      `<strong>${esc(inviter)}</strong> convidou-te para o espaço de trabalho da Young-Link, onde estão os projetos, as tarefas e os documentos da associação.`,
      "Para entrar, só tens de escolher a tua palavra-passe:",
    ],
    cta: "Aceitar convite",
    link,
    notes: [`O teu email de acesso é <strong>${esc(email)}</strong>. O convite é válido durante ${days} dias.`],
    footnote: "Se não estavas à espera deste convite, podes ignorar este email.",
  });
  const text = `Olá ${name.split(" ")[0]},

${inviter} convidou-te para o espaço de trabalho da Young-Link.

Para entrar, escolhe a tua palavra-passe aqui:
${link}

O teu email de acesso é ${email}. O convite é válido durante ${days} dias.

Associação Young-Link`;
  return { subject, html, text };
}

export function resetEmail({ name, email, link, minutes }: { name: string; email: string; link: string; minutes: number }) {
  const subject = "Recuperar a palavra-passe · Young-Link";
  const html = layout({
    subject,
    preheader: "Pediste para definir uma nova palavra-passe no espaço de trabalho.",
    eyebrow: "Segurança",
    title: "Nova palavra-passe",
    intro: [
      `Olá ${esc(name.split(" ")[0])},`,
      `Recebemos um pedido para definir uma nova palavra-passe para <strong>${esc(email)}</strong> no espaço de trabalho da Young-Link.`,
    ],
    cta: "Definir nova palavra-passe",
    link,
    notes: [`O link é válido durante ${minutes} minutos e só pode ser usado uma vez. Ao mudares a palavra-passe, as sessões abertas noutros aparelhos terminam.`],
    footnote: "Se não foste tu que pediste, ignora este email: a tua palavra-passe atual continua a funcionar.",
  });
  const text = `Olá ${name.split(" ")[0]},

Recebemos um pedido para definir uma nova palavra-passe para ${email} no espaço de trabalho da Young-Link.

Define-a aqui (válido durante ${minutes} minutos, uso único):
${link}

Se não foste tu que pediste, ignora este email: a tua palavra-passe atual continua a funcionar.

Associação Young-Link`;
  return { subject, html, text };
}

export function mentionEmail({ name, author, pageTitle, excerpt, link }: { name: string; author: string; pageTitle: string; excerpt: string; link: string }) {
  const subject = `${author} mencionou-te em "${pageTitle}"`;
  const quote = esc(excerpt).replace(/\n/g, "<br>");
  const html = layout({
    subject,
    preheader: `${esc(author)}: ${esc(excerpt.slice(0, 120))}`,
    eyebrow: "Comentário",
    title: "Foste mencionado",
    intro: [
      `Olá ${esc(name.split(" ")[0])},`,
      `<strong>${esc(author)}</strong> mencionou-te num comentário em <strong>${esc(pageTitle)}</strong>:`,
      `<span style="display:block;border-left:3px solid ${BRAND};padding:8px 12px;background:#f5f5f4;border-radius:6px;">${quote}</span>`,
    ],
    cta: "Ver comentário",
    link,
    notes: [],
    footnote: "Recebes este email porque alguém te mencionou com @ no espaço de trabalho da Young-Link.",
  });
  const text = `Olá ${name.split(" ")[0]},

${author} mencionou-te num comentário em "${pageTitle}":

${excerpt}

Ver comentário: ${link}

Associação Young-Link`;
  return { subject, html, text };
}
