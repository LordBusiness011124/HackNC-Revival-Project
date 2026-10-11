export type Role = 'donor' | 'repairer';
export type ChatMessage = { id: string; sender: 'user' | 'lazarus'; text: string; role: Role; channel: 'demo' | 'imessage'; time: string };
export type RepairState = {
  donor: boolean; repairer: boolean;
  messages: ChatMessage[]; events: { id: string; text: string; time: string }[];
  sessions: Record<string, Role>; processed: string[];
  intake: { model: string; symptom: string; source: 'manual' | 'gemini' } | null;
};
export function freshState(): RepairState {
  return { donor: false, repairer: false, messages: [], events: [{ id: crypto.randomUUID(), text: 'Repair LZ-001 opened. Waiting for a donor and a repairer.', time: new Date().toISOString() }], sessions: {}, processed: [], intake: null };
}
export const planStatus = (s: RepairState) => s.donor && s.repairer ? 'ready' : s.donor || s.repairer ? 'assembling' : 'matching';
export function recordEvent(s: RepairState, text: string) {
  s.events.unshift({ id: crypto.randomUUID(), text, time: new Date().toISOString() });
  s.events = s.events.slice(0, 40);
}
export function processMessage(s: RepairState, input: { text: string; session: string; role?: Role; channel: 'demo' | 'imessage'; messageId?: string }): string | null {
  if (input.messageId && s.processed.includes(input.messageId)) return null;
  if (input.messageId) s.processed = [...s.processed.slice(-499), input.messageId];
  const text = input.text.trim().toLowerCase();
  let role = s.sessions[input.session];
  if (input.channel === 'demo' && input.role) role = input.role;
  else if (/\b(repairer|volunteer|repair volunteer)\b/.test(text)) role = 'repairer';
  else if (/\b(donor|donate|screen)\b/.test(text)) role = 'donor';
  if (role) s.sessions[input.session] = role;
  const logRole = role || 'donor';
  s.messages.push({ id: crypto.randomUUID(), sender: 'user', text: input.text.trim(), role: logRole, channel: input.channel, time: new Date().toISOString() });
  let reply: string;
  if (!role) {
    reply = 'Welcome to Lazarus. This is a demo repair for a laptop screen. Reply DONOR to offer the screen, or REPAIRER to volunteer. The inventory and compatibility are demo data.';
  } else if (/^(yes|confirm|confirmed|accept|yep|yeah)[.!\s]*$/.test(text)) {
    s[role] = true;
    recordEvent(s, `${role === 'donor' ? 'Screen donation' : 'Repair volunteer'} confirmed via ${input.channel === 'demo' ? 'demo chat' : 'iMessage'}.`);
    reply = `${role === 'donor' ? 'Your screen donation is reserved' : 'You are confirmed as the repair volunteer'} for LZ-001. ${planStatus(s) === 'ready' ? 'Both contributions are confirmed. The repair plan is ready; the physical repair and tests are still pending.' : 'We are waiting for the other contribution. You can reply CANCEL to withdraw.'}`;
  } else if (/^(cancel|withdraw|no)[.!\s]*$/.test(text)) {
    s[role] = false;
    recordEvent(s, `${role === 'donor' ? 'Donor' : 'Repairer'} withdrew. The plan needs a replacement.`);
    reply = 'Your contribution has been released. The map now shows the missing contribution. Reply YES if you want to rejoin.';
  } else if (text === 'status') {
    reply = `LZ-001: screen ${s.donor ? 'confirmed' : 'needed'}, repairer ${s.repairer ? 'confirmed' : 'needed'}. Physical repair and testing are pending.`;
  } else {
    reply = role === 'donor' ? 'We have a demo match for your screen in repair LZ-001. Can you reserve it for this repair? Reply YES to confirm or CANCEL to decline. Compatibility is seeded demo data.' : 'Repair LZ-001 needs a volunteer with a precision screwdriver kit. Can you help? Reply YES to confirm or CANCEL to decline. Scheduling and physical repair are pending.';
  }
  s.messages.push({ id: crypto.randomUUID(), sender: 'lazarus', text: reply, role: logRole, channel: input.channel, time: new Date().toISOString() });
  s.messages = s.messages.slice(-100);
  return reply;
}
