// protocol.ts — Runtime validation of every inbound client message with zod.
// The engine never trusts a raw socket payload: malformed messages are rejected
// here before they can reach the authoritative state.

import { z } from 'zod'

export const nameSchema = z.string().trim().min(1).max(16)
export const codeSchema = z.string().trim().min(3).max(8).transform(s => s.toUpperCase())
export const tokenSchema = z.string().min(8).max(128)

export const createRoomSchema = z.object({ name: nameSchema })
export const joinRoomSchema = z.object({ code: codeSchema, name: nameSchema })
export const reconnectSchema = z.object({ code: codeSchema, token: tokenSchema })

const claimSchema = z.enum(['suspect', 'weapon', 'location', 'cannot'])

// Discriminated union of every gameplay action the engine understands.
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pickSuspect'), suspectId: z.string().min(1).max(32) }),
  z.object({ type: z.literal('roll') }),
  z.object({ type: z.literal('move'), col: z.number().int().min(0).max(63), row: z.number().int().min(0).max(63) }),
  z.object({ type: z.literal('finishMove') }),
  z.object({ type: z.literal('interrogate'), weaponId: z.string().min(1).max(32) }),
  z.object({ type: z.literal('respond'), claim: claimSchema }),
  z.object({
    type: z.literal('challenge'),
    challengedIndex: z.number().int().min(0).max(5).nullable(),
    revealTargetIndex: z.number().int().min(0).max(5).nullable(),
  }),
  z.object({
    type: z.literal('accuse'),
    suspectId: z.string().min(1).max(32),
    weaponId: z.string().min(1).max(32),
    locationId: z.string().min(1).max(32),
  }),
  z.object({ type: z.literal('endTurn') }),
  z.object({ type: z.literal('continue') }),
])

export type Action = z.infer<typeof actionSchema>

export const EV = {
  // client → server
  createRoom: 'createRoom',
  joinRoom: 'joinRoom',
  reconnect: 'reconnect',
  leaveRoom: 'leaveRoom',
  startGame: 'startGame',
  action: 'action',
  // server → client
  roomUpdate: 'roomUpdate',
  youAre: 'youAre',
  gameView: 'gameView',
  errorMsg: 'errorMsg',
} as const
