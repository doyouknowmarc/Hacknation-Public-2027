"use client";
import { useEffect, useRef, useState } from "react";
import type { FrameAnalysis } from "@/lib/teach-types";
import type { Moment } from "@/lib/types";
export function useScreenCapture(
  onEvents: (events: Moment[]) => void,
  onError: (text: string) => void,
  onStopped: () => void,
  onAnalysis?: (analysis: FrameAnalysis) => void,
) {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const metadata = useRef<{
    revision?: string;
    action?: string | null;
    invoice?: string;
  }>({});
  const paused = useRef(false);
  const generation = useRef(0);
  const [sharing, setSharing] = useState(false);
  const [frames, setFrames] = useState(0);
  const config = useRef<{ id: string; elapsed: () => number } | null>(null);
  const controller = useRef<AbortController | null>(null);
  async function share(id: string, elapsed: () => number) {
    const media = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "browser" },
      audio: false,
      selfBrowserSurface: "exclude",
    } as DisplayMediaStreamOptions);
    if (stream.current) stop();
    stream.current = media;
    config.current = { id, elapsed };
    const v = document.createElement("video");
    v.srcObject = media;
    v.muted = true;
    await v.play();
    video.current = v;
    setSharing(true);
    paused.current = false;
    media.getVideoTracks()[0].onended = () => {
      stop();
      onStopped();
    };
  }
  function stop() {
    generation.current++;
    paused.current = true;
    queued.current = false;
    controller.current?.abort();
    stream.current?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    stream.current = null;
    video.current = null;
    setSharing(false);
  }
  function setPaused(value: boolean) {
    paused.current = value;
    generation.current++;
    queued.current = false;
    if (value) controller.current?.abort();
  }
  async function click(
    meta: { revision?: string; action?: string | null; invoice?: string } = {},
  ) {
    metadata.current = meta;
    if (paused.current || !video.current || !config.current) return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    const captureMeta = { ...meta };
    const epoch = generation.current;
    const c = new AbortController();
    controller.current = c;
    try {
      const v = video.current;
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(1280, v.videoWidth);
      canvas.height = Math.round((v.videoHeight * canvas.width) / v.videoWidth);
      canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/jpeg", 0.75),
      );
      if (!blob || paused.current || epoch !== generation.current) return;
      const form = new FormData();
      form.append("sessionId", config.current.id);
      form.append("t", String(config.current.elapsed()));
      form.append("analyze", "true");
      if (captureMeta.revision) form.append("revision", captureMeta.revision);
      if (captureMeta.action) form.append("action", captureMeta.action);
      if (captureMeta.invoice)
        form.append("expectedInvoice", captureMeta.invoice);
      form.append("image", blob, "frame.jpg");
      const r = await fetch("/api/frame", {
        method: "POST",
        body: form,
        signal: c.signal,
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      if (epoch !== generation.current || paused.current) return;
      if (body.frame) setFrames((n) => n + 1);
      if (body.visionError) onError(body.visionError);
      if (body.events?.length) onEvents(body.events);
      onAnalysis?.({ ...body, revision: captureMeta.revision });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        onError(e instanceof Error ? e.message : "Capture failed");
    } finally {
      inFlight.current = false;
      if (queued.current && !paused.current) {
        queued.current = false;
        void click(metadata.current);
      }
    }
  }
  useEffect(() => () => stop(), []);
  return { share, stop, click, setPaused, sharing, frames };
}
