import { useEffect, useState } from "react";
import {
  Cpu,
  Leaf,
  Plus,
  MessageCircle,
  ArrowRight,
  Camera,
  Radio,
  Copy,
  Link,
  Database,
  Sparkles,
} from "lucide-react";
import type { Device } from "../server/live";
type State = {
  devices: Device[];
  events: { id: string; text: string; time: string }[];
  messages: { id: string; text: string; sender: string; time: string }[];
  matches: { target: string; donor: string; part: string; status: string }[];
  metrics: {
    devices: number;
    photos: number;
    messages: number;
    timescale: boolean;
    hourly: { hour: string; count: number }[];
  };
  integration: {
    photon: string;
    gemini: boolean;
    storage: string;
    detail: string;
  };
};
export default function App() {
  const [state, setState] = useState<State>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("");
  const [parts, setParts] = useState("");
  const [role, setRole] = useState("repair-target");
  const [photo, setPhoto] = useState<{ mimeType: string; data: string }>();
  const [preview, setPreview] = useState("");
  const [links, setLinks] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("hepha-links") || "{}");
    } catch {
      return {};
    }
  });
  const [selected, setSelected] = useState("");
  async function refresh() {
    const r = await fetch("/api/state");
    if (!r.ok)
      throw Error(
        "Unable to connect to storage. If DATABASE_URL is set, check your Tiger Data connection.",
      );
    setState(await r.json());
  }
  useEffect(() => {
    const tick = () => refresh().catch((e) => setError(e.message));
    tick();
    const timer = setInterval(tick, 2000);
    return () => clearInterval(timer);
  }, []);
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("Choose a photo under 8 MB.");
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setPhoto({
      mimeType:
        file.type || (/\.heic$/i.test(file.name) ? "image/heic" : "image/jpeg"),
      data: data.split(",")[1],
    });
    setPreview(data);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: owner || "You",
          description,
          role,
          photo,
          model,
          parts,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      const next = { ...links, [data.device.id]: data.linkCode };
      setLinks(next);
      localStorage.setItem("hepha-links", JSON.stringify(next));
      setSelected(data.device.id);
      setShow(false);
      setDescription("");
      setModel("");
      setParts("");
      setPhoto(undefined);
      setPreview("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const device =
    state?.devices.find((d) => d.id === selected) || state?.devices.at(-1);
  const matches =
    state?.matches.filter(
      (m) => m.target === device?.id || m.donor === device?.id,
    ) || [];
  return (
    <div className="app-shell">
      <aside className="rail">
        <span className="brand-mark">
          <Leaf />
        </span>
        <span className="rail-button active">
          <Sparkles />
        </span>
        <div className="rail-spacer" />
        <span className="rail-button">
          <Database />
        </span>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <a href="#" className="wordmark">
            revival<span>↗</span>
          </a>
          <span className="tagline">GOOD THINGS DESERVE A SECOND LIFE.</span>
          <span className="campus">
            <span className="status-dot" /> Your repair network
          </span>
        </header>
        <main>
          <section className="heading">
            <div>
              <div className="eyebrow">THE COMMUNITY REPAIR LAB</div>
              <h1>
                A second life starts here<span>.</span>
              </h1>
              <p>
                Start on the web. Send a photo. Keep the conversation going in
                iMessage.
              </p>
            </div>
            <button className="primary-button" onClick={() => setShow(true)}>
              <Plus size={17} />
              Add a device
            </button>
          </section>
          <section className="stats">
            <div>
              <span className="stat-icon blue">
                <Cpu />
              </span>
              <div>
                <strong>
                  {state?.metrics.devices || 0} <small>real devices</small>
                </strong>
                <span>Submitted to this network</span>
              </div>
            </div>
            <div>
              <span className="stat-icon mint">
                <Camera />
              </span>
              <div>
                <strong>
                  {state?.metrics.photos || 0} <small>device photos</small>
                </strong>
                <span>Website and iMessage intake</span>
              </div>
            </div>
            <div>
              <span className="stat-icon blue">
                <Link />
              </span>
              <div>
                <strong>
                  {state?.matches.length || 0}{" "}
                  <small>candidate connections</small>
                </strong>
                <span>Human compatibility check needed</span>
              </div>
            </div>
            <div>
              <span className="stat-icon blue">
                <Database />
              </span>
              <div>
                <strong>
                  {state?.integration.storage === "tiger"
                    ? "Tiger Data"
                    : "Local storage"}
                </strong>
                <span>
                  {state?.metrics.timescale
                    ? "Timescale activity tracking active"
                    : state?.integration.storage === "tiger"
                      ? "Postgres activity tracking"
                      : "Add DATABASE_URL to enable Tiger Data"}
                </span>
              </div>
            </div>
          </section>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          <div className="lab-layout">
            <div className="left-column">
              <section className="map-panel">
                <div className="panel-header">
                  <h2>Resurrection map</h2>
                  <span className="pill">LIVE INTAKE</span>
                </div>
                <div className="real-map">
                  {!state?.devices.length ? (
                    <div className="empty-network">
                      <Sparkles size={44} />
                      <h2>Your network starts with one device.</h2>
                      <p>
                        Add a broken device or a donor unit. Real submissions
                        appear here as they arrive.
                      </p>
                      <button
                        className="primary-button"
                        onClick={() => setShow(true)}
                      >
                        Start a repair <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="device-grid">
                        {state.devices.map((d) => (
                          <button
                            key={d.id}
                            className={`real-device ${device?.id === d.id ? "chosen" : ""}`}
                            onClick={() => setSelected(d.id)}
                          >
                            {d.photo ? (
                              <img src={d.photo} alt={`Submitted ${d.model}`} />
                            ) : (
                              <div className="device-placeholder">
                                <Cpu size={48} />
                              </div>
                            )}
                            <span className="node-kind">
                              {d.role === "donor"
                                ? "DONOR DEVICE"
                                : "DEVICE TO REVIVE"}{" "}
                              · {d.id}
                            </span>
                            <strong>{d.model}</strong>
                            <span>
                              {d.owner} · {d.source}
                            </span>
                            <p>{d.description}</p>
                            {d.analysis === "pending" && (
                              <small>
                                AI unavailable · saved for manual review
                              </small>
                            )}
                            <div className="skill-tags">
                              {d.parts.map((p) => (
                                <span key={p}>
                                  {d.role === "donor" ? "Offers" : "Needs"} {p}
                                </span>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                      {state.matches.length > 0 && (
                        <div className="connection-list">
                          <h3>Possible connections</h3>
                          {state.matches.map((m, i) => (
                            <div key={i}>
                              <span>{m.donor}</span>
                              <ArrowRight size={18} />
                              <strong>{m.part}</strong>
                              <ArrowRight size={18} />
                              <span>{m.target}</span>
                              <small>
                                Review exact part number, connector and
                                condition before reserving.
                              </small>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="map-note">
                  Photos help identify devices. They do not establish part
                  compatibility or working condition.
                </div>
              </section>
              <section className="activity-panel">
                <h2>
                  <Radio size={16} /> Around the lab
                </h2>
                {!state?.events.length && (
                  <p>No activity yet. Your first intake will appear here.</p>
                )}
                {state?.events.slice(0, 8).map((e) => (
                  <div className="activity" key={e.id}>
                    <span className="event-dot latest" />
                    <p>{e.text}</p>
                    <time>
                      {new Date(e.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                ))}
              </section>
            </div>
            <aside className="right-column">
              <section className="plan-panel">
                <div className="eyebrow">CONTINUE ON YOUR PHONE</div>
                <h2>One device. One conversation.</h2>
                <p>
                  Take a photo of your device or its model label and send it to
                  your Photon iMessage line. Gemini reads the photo, asks for
                  missing details and saves it here.
                </p>
                <div className="integration-info">
                  <span
                    className={`status-dot ${state?.integration.photon === "live" ? "" : "amber"}`}
                  />
                  {state?.integration.detail || "Connecting…"}
                </div>
                {device && (
                  <>
                    <h3>{device.model}</h3>
                    <p>
                      {device.id} · {matches.length} candidate connection(s)
                    </p>
                    {device.phoneConnected ? (
                      <p className="help-note">
                        Connected to iMessage. Send your next photo in the same
                        phone thread.
                      </p>
                    ) : links[device.id] ? (
                      <div className="link-box">
                        <p>
                          Text this command to your Photon line to connect this
                          website intake:
                        </p>
                        <code>LINK {links[device.id]}</code>
                        <button
                          className="subtle-button"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(`LINK ${links[device.id]}`)
                              .catch(() =>
                                setError("Copy the LINK command manually."),
                              )
                          }
                        >
                          <Copy size={14} /> Copy command
                        </button>
                      </div>
                    ) : (
                      <p>
                        This device was submitted through iMessage or from
                        another browser.
                      </p>
                    )}
                  </>
                )}
                <div className="help-note">
                  Text <strong>STATUS</strong> for an update,{" "}
                  <strong>NEW</strong> for another device, or{" "}
                  <strong>DONATE</strong> followed by the model and parts you
                  can offer. Send photos directly in the same thread.
                </div>
              </section>
              <section className="chat-panel">
                <div className="chat-heading">
                  <MessageCircle />
                  <div>
                    <h2>Live iMessage activity</h2>
                    <span>Actual inbound messages and replies</span>
                  </div>
                </div>
                <div className="chat-messages">
                  {!state?.messages.length && (
                    <p className="chat-hint">
                      Send a photo or LINK command to your Photon line. The
                      actual conversation will appear here.
                    </p>
                  )}
                  {state?.messages.slice(-15).map((m) => (
                    <div
                      key={m.id}
                      className={`bubble ${m.sender === "user" ? "user" : "assistant"}`}
                    >
                      <span>{m.text}</span>
                      <small>
                        {new Date(m.time).toLocaleTimeString()} · iMessage
                      </small>
                    </div>
                  ))}
                </div>
              </section>
              {Boolean(state?.metrics.hourly.length) && (
                <section className="activity-panel">
                  <h3>Tiger Data · last 24 hours</h3>
                  {state?.metrics.hourly.map((h) => (
                    <p key={h.hour}>
                      {new Date(h.hour).toLocaleTimeString([], {
                        hour: "2-digit",
                      })}
                      : {h.count} messages
                    </p>
                  ))}
                </section>
              )}
            </aside>
          </div>
          <footer>
            <span>
              <Leaf size={13} /> Less waste. More possibility.
            </span>
            <span>Revival · Community repair in motion</span>
          </footer>
        </main>
      </div>
      {show && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intake-title"
          >
            <button
              className="modal-close"
              onClick={() => !busy && setShow(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 id="intake-title">What can we bring back?</h2>
            <form onSubmit={submit}>
              <label>
                Your name
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  maxLength={80}
                />
              </label>
              <label>
                Device purpose
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="repair-target">I need a repair</option>
                  <option value="donor">I can offer a donor device</option>
                </select>
              </label>
              <label>
                Tell us about the device
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  placeholder="Model, what is broken, or which tested parts you can offer"
                />
              </label>
              <div className="photo-buttons">
                <label className="subtle-button">
                  <Camera size={16} /> Take a photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                </label>
                <label className="subtle-button">
                  Upload photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                </label>
              </div>
              {preview && (
                <img
                  className="intake-photo"
                  src={preview}
                  alt="Photo to submit"
                />
              )}
              <details>
                <summary>Known model and parts (optional)</summary>
                <label>
                  Exact model
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    maxLength={150}
                  />
                </label>
                <label>
                  {role === "donor" ? "Offered parts" : "Needed parts"}
                  <input
                    value={parts}
                    onChange={(e) => setParts(e.target.value)}
                    placeholder="screen, battery"
                    maxLength={300}
                  />
                </label>
              </details>
              <p className="fine-print">
                Gemini extracts visible details. You can continue with photos
                and messages from your phone.
              </p>
              {error && <p role="alert">{error}</p>}
              <button
                className="primary-button"
                disabled={busy || (!description.trim() && !photo)}
              >
                {busy ? "Reading and saving…" : "Add real device"}
                <ArrowRight size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
