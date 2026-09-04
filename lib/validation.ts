import { z } from "zod";

export const roleEnum = z.enum(["batter", "bowler", "keeper", "allrounder"]);
const rating = z.number().int().min(1).max(10);

export const registerSchema = z.object({
  inviteCode: z.string().trim().min(3).max(16),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  password: z.string().min(8).max(200),
  consent: z.literal(true),
});

export const createClubSchema = z.object({
  clubName: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  password: z.string().min(8).max(200),
  consent: z.literal(true),
});

export const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const invitePlayerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
});

export const reinviteSchema = z.object({
  memberId: z.string().uuid(),
});

export const onboardingSchema = z.object({
  password: z.string().min(8).max(200),
  consent: z.literal(true),
});

export const accountSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(160),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(120),
  password: z.string().min(8).max(200),
});

export const profileSchema = z.object({
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  roles: z.array(roleEnum).max(4),
  battingStyle: z.enum(["right", "left"]).nullable().optional(),
  bowlingType: z.enum(["pace", "off-spin", "leg-spin", "left-arm"]).nullable().optional(),
  batSelf: rating,
  bowlSelf: rating,
  fieldSelf: rating,
  isKeeper: z.boolean(),
  happyToCaptain: z.boolean(),
});

export const matchDaySchema = z.object({
  playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ground: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  playerIds: z.array(z.string().uuid()).min(4).max(40),
});

export const createMatchSchema = z.object({
  matchDayId: z.string().uuid(),
  overs: z.number().int().min(1).max(50),
  playersPerSide: z.number().int().min(2).max(11),
  sideAName: z.string().trim().min(1).max(40),
  sideBName: z.string().trim().min(1).max(40),
  rules: z.object({
    wideNoballPenalty: z.number().int().min(1).max(2),
    freeHitOnNoball: z.boolean(),
    byesEnabled: z.boolean(),
    lastManStands: z.boolean(),
  }),
  squad: z
    .array(
      z.object({
        memberId: z.string().uuid(),
        side: z.enum(["a", "b"]),
        battingOrder: z.number().int().min(1).max(20),
        isCaptain: z.boolean(),
        isKeeper: z.boolean(),
      })
    )
    .min(4)
    .max(24),
});

export const setupSchema = z.object({
  tossWinner: z.enum(["a", "b"]),
  elected: z.enum(["bat", "field"]),
});

export const eventSchema = z.object({
  clientUuid: z.string().uuid(),
  event: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("openers"),
      strikerId: z.string().uuid(),
      nonStrikerId: z.string().uuid(),
    }),
    z.object({ type: z.literal("bowler"), bowlerId: z.string().uuid() }),
    z.object({
      type: z.literal("delivery"),
      payload: z.object({
        runsBat: z.number().int().min(0).max(8),
        extra: z.enum(["wide", "noball", "bye", "legbye"]).optional(),
        extraRuns: z.number().int().min(0).max(8).optional(),
        wicket: z
          .object({
            type: z.enum([
              "bowled",
              "caught",
              "lbw",
              "stumped",
              "run_out",
              "hit_wicket",
              "obstructing",
              "retired_out",
            ]),
            who: z.enum(["striker", "non_striker"]),
            crossed: z.boolean().optional(),
            fielderId: z.string().uuid().nullable().optional(),
          })
          .optional(),
      }),
    }),
    z.object({ type: z.literal("new_batter"), batterId: z.string().uuid() }),
    z.object({ type: z.literal("swap_strike") }),
    z.object({ type: z.literal("retire"), batterId: z.string().uuid(), out: z.boolean() }),
    z.object({ type: z.literal("close_innings"), reason: z.string().max(40) }),
  ]),
});
