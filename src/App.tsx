import { useEffect, useRef, useState } from "react";
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
  CircleHelp,
} from "lucide-react";
import type { Device } from "../server/live";
import { sharedParts } from "./parts";
type State = {
  devices: Device[];
  events: { id: string; text: string; time: string }[];
  messages: { id: string; deviceId?: string; text: string; sender: string; time: string }[];
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
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState<Device>();
  const [editModel, setEditModel] = useState("");
  const [editParts, setEditParts] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("");
  const [parts, setParts] = useState("");
  const [role, setRole] = useState("repair-target");
  const [photo, setPhoto] = useState<{ mimeType: string; data: string }>();
  const [preview, setPreview] = useState("");
  const uploadInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream>();
  useEffect(() => {
    if (cameraVideo.current && cameraStream) cameraVideo.current.srcObject = cameraStream;
    return () => cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);
  useEffect(() => { if (!show) setCameraStream(undefined); }, [show]);
  async function takePhoto() {
    setError("");
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) { cameraInput.current?.click(); return; }
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error("Camera unavailable");
      setCameraStream(await navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
    } catch {
      setError("Camera access is unavailable or was denied. Use Upload photo, or send a photo through iMessage.");
    }
  }
  async function capturePhoto() {
    const video = cameraVideo.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (blob) { await upload(new File([blob], "camera-photo.jpg", { type: "image/jpeg" })); setCameraStream(undefined); }
  }
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
    setError("");
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) { setError("Choose an image file."); return; }
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
          location,
          email,
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
      setLocation("");
      setEmail("");
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
  async function removeDevice(d: Device) {
    if (!window.confirm(`Remove ${d.model} from the network? Its candidate connections will also disappear.`)) return;
    try {
      const r = await fetch(`/api/devices/${encodeURIComponent(d.id)}`, { method: "DELETE" });
      if (!r.ok) throw Error("Could not remove this item. Please try again.");
      const next = { ...links };
      delete next[d.id];
      setLinks(next);
      localStorage.setItem("hepha-links", JSON.stringify(next));
      setSelected("");
      await refresh();
    } catch (e) { setError((e as Error).message); }
  }
  async function editContact(d: Device) {
    const value = window.prompt("Contact email (visible to this network). Leave blank to remove it.", d.email || "");
    if (value === null) return;
    try {
      const r = await fetch(`/api/devices/${encodeURIComponent(d.id)}/contact`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: value.trim() }),
      });
      if (!r.ok) throw Error(r.status === 400 ? "Enter a valid email address." : "Could not update contact email.");
      await refresh();
    } catch (e) { setError((e as Error).message); }
  }
  const matches =
    state?.matches.filter(
      (m) => m.target === device?.id || m.donor === device?.id,
    ) || [];
  const recommendedDonors = device?.role === "repair-target"
    ? (state?.devices || []).filter((d) => d.role === "donor" && sharedParts(device.parts, d.parts).length > 0)
        .sort((a, b) => Number(b.model.toLowerCase() === device.model.toLowerCase()) - Number(a.model.toLowerCase() === device.model.toLowerCase()) || Number(b.location?.toLowerCase() === device.location?.toLowerCase()) - Number(a.location?.toLowerCase() === device.location?.toLowerCase()))
    : [];
  const contactLeads = (state?.devices || []).filter((d) => d.role === "repair-target").reduce((count, target) => count + (state?.devices || []).filter((d) => d.role === "donor" && sharedParts(target.parts, d.parts).length > 0).length, 0);
  return (
    <div className="app-shell">
      <aside className="rail">
        <a href="#" className="brand-mark" aria-label="Back to top" title="Back to top">
          <Leaf />
        </a>
        <a href="#repair-network" className="rail-button active" aria-label="Repair network" title="Repair network">
          <Sparkles />
        </a>
        <div className="rail-spacer" />
        <a href="#how-it-works" className="rail-button" aria-label="How it works" title="How it works">
          <CircleHelp />
        </a>
        <a href="#network-activity" className="rail-button" aria-label="Network activity" title="Network activity">
          <Database />
        </a>
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
                Post the parts you need or can offer here, or send them directly
                through iMessage. Choose whichever is easier.
              </p>
              <a className="phone-intake-link" href="sms:+14152024086">
                Text Revival: +1 (415) 202-4086
              </a>
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
                  {contactLeads}{" "}
                  <small>people to contact</small>
                </strong>
                <span>{contactLeads ? "Part offers found · compatibility unverified" : "No donor offers for needed parts yet"}</span>
              </div>
            </div>
            <div>
              <span className="stat-icon blue">
                <Database />
              </span>
              <div>
                <strong>
                  {state?.metrics.messages || 0} <small>messages saved</small>
                </strong>
                <span>
                  Website and phone conversation history
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
                <div className="real-map" id="repair-network">
                  <label className="location-filter">
                    Find submissions by town or campus
                    <input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="e.g. Chapel Hill or UNC" />
                  </label>
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
                        {locationFilter.trim() && !state.devices.some((d) => d.location?.toLowerCase().includes(locationFilter.trim().toLowerCase())) && (
                          <p>No submissions match this location. Try another town or campus, or clear the filter.</p>
                        )}
                        {state.devices.filter((d) => !locationFilter.trim() || d.location?.toLowerCase().includes(locationFilter.trim().toLowerCase())).map((d) => (
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
                            <span>{d.location ? `Location: ${d.location}` : "Location not provided"}</span>
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
              <section className="activity-panel" id="network-activity">
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
              {device?.role === "repair-target" && (
                <section className="plan-panel recommendations-panel">
                  <h2>People who may have your parts</h2>
                  <p>People offering the parts you need. Same reported models appear first, followed by people in your area. These are leads to contact, not confirmed compatible parts.</p>
                  {recommendedDonors.length ? recommendedDonors.map((donor) => (
                    <article className="donor-recommendation" key={donor.id}>
                      <h3>{donor.owner}</h3>
                      <p>{donor.model} · {donor.location || "Location not provided"}</p>
                      <p>Offers: {sharedParts(device.parts, donor.parts).join(", ")}</p>
                      <p>{device.model !== "Unverified device" && donor.model.trim().toLowerCase() === device.model.trim().toLowerCase() ? "Same reported model. " : "Model compatibility is unknown. "}Ask the owner to confirm the exact part number and condition.</p>
                      {donor.email ? (
                        <a className="phone-intake-link" href={`mailto:${donor.email}?subject=${encodeURIComponent(`Revival: asking about ${donor.model} parts`)}&body=${encodeURIComponent(`Hi ${donor.owner}, I found your offer on Revival (${donor.id}). I need parts for ${device.model}. Can you confirm which parts are available, their part numbers and working condition?`)}`}>Email {donor.owner}</a>
                      ) : <p>No contact email shared yet.</p>}
                      <button className="subtle-button" onClick={() => setSelected(donor.id)}>View donor item</button>
                    </article>
                  )) : (
                    <div className="help-note">
                      <strong>No donor offers for your needed parts yet.</strong>
                      <p>{!device.parts.length ? "Add your needed parts using Edit item details so we can suggest people to contact." : "Your request is saved. People offering those parts will appear here when they submit an item."}</p>
                    </div>
                  )}
                </section>
              )}
              <section className="plan-panel">
                <div className="eyebrow">START OR CONTINUE THROUGH IMESSAGE</div>
                <h2>Use the website or your phone.</h2>
                <p>
                  Text <a href="sms:+14152024086">+1 (415) 202-4086</a> with the item and parts you need, or text DONATE followed by the item and parts you can offer. You can send a photo too. No website submission is required.
                </p>
                <p>Text LOCATION followed by your town or campus to add where your item is available.</p>
                <div className="integration-info">
                  <span
                    className={`status-dot ${state?.integration.photon === "live" ? "" : "amber"}`}
                  />
                  {state?.integration.detail || "Connecting…"}
                </div>
                {device && (
                  <>
                    <h3>{device.model}</h3>
                    <div className="item-actions">
                    <button className="subtle-button" onClick={() => { setEditing(device); setEditModel(device.model); setEditParts(device.parts.join(", ")); setEditLocation(device.location || ""); }}>Edit item details</button>
                    {device.email && <a className="phone-intake-link" href={`mailto:${device.email}?subject=${encodeURIComponent(`Revival: ${device.model} (${device.id})`)}`}>Email owner</a>}
                    <button className="subtle-button" onClick={() => void editContact(device)}>{device.email ? "Edit contact email" : "Add contact email"}</button>
                    <button className="subtle-button remove-action" onClick={() => void removeDevice(device)}>Remove item</button>
                    </div>
                    <p>
                      {device.id} · {matches.length} same-model part match(es)
                    </p>
                    <p className="fine-print">{device.role === "repair-target" ? `${recommendedDonors.length} donor lead(s) to contact. ` : ""}Matches and leads are suggestions, not completed repairs.</p>
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
                  {state?.messages.filter((m) => Boolean(device) && m.deviceId === device?.id).slice(-15).map((m) => (
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
          <section className="activity-panel how-it-works" id="how-it-works">
            <h2><CircleHelp size={20} /> How to use Revival</h2>
            <p>Post parts you need or can offer through either the website or iMessage. Both create listings in the same network. Revival works with repairable items of any kind; electronics are one example.</p>
            <ol>
              <li><strong>Choose how to post.</strong> On the website, click “Add a device,” choose whether you need a repair or can offer parts, and describe your item. Or start directly in iMessage: text the item and parts you need to +1 (415) 202-4086. To offer parts, text DONATE followed by the item and available parts. You do not need to use both.</li>
              <li><strong>Be specific.</strong> Enter the exact model or item name and list parts separately, such as “battery, screen.” Add your town or campus. A clear photo of the item and its model label helps Gemini read the details.</li>
              <li><strong>Check the saved details.</strong> Select your item and use “Edit item details” to correct the model, parts or location. Clear part names help us suggest people to contact.</li>
              <li><strong>Keep the same listing updated.</strong> If you started on the website and want to continue by phone, text its one-use LINK command to <a href="sms:+14152024086">+1 (415) 202-4086</a>. If you started in iMessage, your listing already appears on the website. Send photos and updates in the same thread. Text STATUS for a summary, LOCATION followed by your town to set location, or NEW to start another item.</li>
              <li><strong>Contact a potential donor.</strong> Select your repair request to see people offering your needed parts. “Email owner” opens your mail app. Add an optional contact email if you want people to reach you; it is visible to this network.</li>
              <li><strong>Confirm before using a part.</strong> Ask about the exact part number, measurements or connector, working condition, and pickup arrangements. Suggestions are leads, not verified compatibility.</li>
            </ol>
            <p><strong>Keep the network useful:</strong> correct inaccurate details, describe only parts you can genuinely offer, and remove an item when it is no longer available. If there are no donor offers yet, keep your request accurate so new submissions can match it.</p>
          </section>
          <footer>
            <span>
              <Leaf size={13} /> Less waste. More possibility.
            </span>
            <span>Revival · Community repair in motion</span>
          </footer>
          <section className="activity-panel">
            <h3>The tracks behind Revival</h3>
            <p><strong>Community:</strong> connects people who need parts with people offering them.</p>
            <p><strong>Frutiger Aero:</strong> blue sky, water, glass and greenery reflect a connected future with less waste.</p>
            <p><strong>Gemini:</strong> extracts item details and parts from descriptions and photos.</p>
            <p><strong>Photon:</strong> lets people submit and update listings through iMessage.</p>
            <p><strong>Tiger Data:</strong> stores inventory and conversations, runs SQL matches, and tracks activity with Timescale.</p>
          </section>
        </main>
      </div>
      {editing && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <button className="modal-close" aria-label="Close editor" onClick={() => setEditing(undefined)}>×</button>
            <h2 id="edit-title">Edit item details</h2>
            <form onSubmit={async (e) => {
              e.preventDefault(); setBusy(true); setError("");
              try {
                const r = await fetch(`/api/devices/${encodeURIComponent(editing.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: editModel, parts: editParts, location: editLocation }) });
                if (!r.ok) throw Error("Could not save item details. Check the fields and try again.");
                await refresh(); setEditing(undefined);
              } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
            }}>
              <label>Model or item name<input required maxLength={150} value={editModel} onChange={(e) => setEditModel(e.target.value)} /></label>
              <label>{editing.role === "donor" ? "Offered parts" : "Needed parts"}<input maxLength={300} placeholder="screen, battery" value={editParts} onChange={(e) => setEditParts(e.target.value)} /></label>
              <label>Town or campus<input maxLength={150} value={editLocation} onChange={(e) => setEditLocation(e.target.value)} /></label>
              {error && <p role="alert">{error}</p>}
              <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
            </form>
          </section>
        </div>
      )}
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
                Town or campus (optional)
                <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={150} placeholder="Chapel Hill, NC or UNC campus" />
              </label>
              <label>
                Contact email (optional, visible to this network)
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} placeholder="you@example.com" />
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
                <button type="button" className="subtle-button" onClick={() => void takePhoto()}>
                  <Camera size={16} /> Take a photo
                </button>
                  <input ref={cameraInput} hidden aria-label="Choose camera photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }}
                  />
                <button type="button" className="subtle-button" onClick={() => uploadInput.current?.click()}>
                  Upload photo
                </button>
                  <input ref={uploadInput} hidden aria-label="Choose photo file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }}
                  />
              </div>
              {cameraStream && <div>
                <video ref={cameraVideo} autoPlay playsInline muted style={{ width: "100%", borderRadius: 10 }} />
                <button type="button" className="subtle-button" onClick={() => void capturePhoto()}>Capture photo</button>
                <button type="button" className="subtle-button" onClick={() => setCameraStream(undefined)}>Cancel camera</button>
              </div>}
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
