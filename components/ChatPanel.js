"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const MAX_LENGTH = 2000;

// Lightweight per-appointment text chat — replaces Daily's own in-call
// chat panel (see enable_chat: false in functions/index.js). Backed
// entirely by Firestore (appointments/{appointmentId}/messages), with no
// extra dependency: onSnapshot gives real-time updates for free, the
// same way the rest of the app already talks to Firestore. Access is
// governed by firestore.rules — only the patient or doctor on this
// appointment can read or send.
export default function ChatPanel({ appointmentId, currentUserId, otherPartyName }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (!appointmentId) return;
    const q = query(
      collection(db, "appointments", appointmentId, "messages"),
      orderBy("sentAt", "asc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error(err);
        setError("Couldn't load chat messages.");
      }
    );
    return () => unsubscribe();
  }, [appointmentId]);

  // Keep the message list scrolled to the newest message as they arrive.
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError("");
    try {
      await addDoc(collection(db, "appointments", appointmentId, "messages"), {
        senderId: currentUserId,
        text: text.slice(0, MAX_LENGTH),
        sentAt: serverTimestamp(),
      });
      setDraft("");
    } catch (err) {
      console.error(err);
      setError("Message couldn't be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: 420,
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--card-bg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Chat{otherPartyName ? ` with ${otherPartyName}` : ""}
      </div>

      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "var(--ink-faint)", fontSize: 14, margin: "auto" }}>
            No messages yet — say hello.
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.senderId === currentUserId;
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isOwn ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: isOwn ? "var(--indigo)" : "var(--paper)",
                color: isOwn ? "var(--paper)" : "var(--ink)",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 14,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {msg.text}
            </div>
          );
        })}
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, padding: "0 16px", margin: "0 0 8px" }}>
          {error}
        </p>
      )}

      <form
        onSubmit={handleSend}
        style={{
          display: "flex",
          gap: 8,
          padding: 12,
          borderTop: "1px solid var(--border)",
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          maxLength={MAX_LENGTH}
          disabled={sending}
          className="input"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={sending || !draft.trim()} className="btnPrimary">
          Send
        </button>
      </form>
    </div>
  );
}
