import type { Role } from '@/lib/db/schema';

export type AddFailure =
  | 'invalid_name'
  | 'invalid_characters'
  | 'not_found'
  | 'wrong_guild'
  | 'taken'
  | 'already_yours'
  | 'unavailable';

const messages: Record<AddFailure, string> = {
  invalid_name: 'Skriv både fornavn og efternavn.',
  invalid_characters: 'Karakternavne må kun indeholde bogstaver, mellemrum, bindestreg og apostrof.',
  not_found: 'Karakteren findes ikke i armory. Tjek stavningen.',
  wrong_guild: 'Karakteren er ikke i guilden AULA.',
  taken: 'Karakteren er allerede koblet til en anden spiller. Kontakt en officer.',
  already_yours: 'Du har allerede tilføjet den karakter.',
  unavailable: 'Armory svarer ikke lige nu, prøv igen om lidt.',
};

export function addCharacterMessage(reason: AddFailure): string {
  return messages[reason];
}

const roleLabels: Record<Role, string> = { tank: 'Tank', healer: 'Healer', dps: 'DPS' };

export function roleLabel(role: Role): string {
  return roleLabels[role];
}
