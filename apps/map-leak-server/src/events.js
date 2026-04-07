import { EventEmitter } from "node:events";

export const leakEvents = new EventEmitter();
leakEvents.setMaxListeners(500);

export function emitLeak(finding) {
  leakEvents.emit("leak", finding);
}
