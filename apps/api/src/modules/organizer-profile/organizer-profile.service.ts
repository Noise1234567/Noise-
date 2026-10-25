import type { OrganizerContactDto, OrganizerProfileResponse } from '@noise/shared';
import type { OrganizerProfile } from '../../generated/prisma/client.js';
import type { PrismaClient } from '../../lib/prisma.js';

/** Champs validés et normalisés par updateOrganizerProfileSchema (null = effacé). */
export type OrganizerProfileUpdate = Record<keyof OrganizerContactDto, string | null>;

const EMPTY: OrganizerContactDto = {
  whatsapp: null,
  instagram: null,
  facebook: null,
  tiktok: null,
};

/** Contacts publics de l'organisateur ; tout à null quand il n'a rien renseigné. */
export const toOrganizerContact = (
  profile: Pick<
    OrganizerProfile,
    'whatsappPhone' | 'instagramUrl' | 'facebookUrl' | 'tiktokUrl'
  > | null,
): OrganizerContactDto =>
  profile
    ? {
        whatsapp: profile.whatsappPhone,
        instagram: profile.instagramUrl,
        facebook: profile.facebookUrl,
        tiktok: profile.tiktokUrl,
      }
    : EMPTY;

/** Profil public de l'organisateur connecté (NOISE-061). */
export class OrganizerProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  async getMine(userId: string): Promise<OrganizerProfileResponse> {
    const profile = await this.prisma.organizerProfile.findUnique({ where: { userId } });
    return { profile: toOrganizerContact(profile) };
  }

  /** Remplace tout le profil : un champ absent ou vide est effacé. */
  async replaceMine(
    userId: string,
    input: OrganizerProfileUpdate,
  ): Promise<OrganizerProfileResponse> {
    const data = {
      whatsappPhone: input.whatsapp,
      instagramUrl: input.instagram,
      facebookUrl: input.facebook,
      tiktokUrl: input.tiktok,
    };
    const profile = await this.prisma.organizerProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return { profile: toOrganizerContact(profile) };
  }
}
