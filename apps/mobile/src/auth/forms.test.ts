import { formatLocalPhone, toApiPhone, validateLogin, validateSignup } from './forms';

describe('formatage du téléphone', () => {
  it('regroupe les chiffres par deux et limite à 10', () => {
    expect(formatLocalPhone('0197452138')).toBe('01 97 45 21 38');
    expect(formatLocalPhone('01 97 45 21 38 99')).toBe('01 97 45 21 38');
    expect(formatLocalPhone('abc01-97')).toBe('01 97');
  });

  it("ajoute l'indicatif +229 pour l'API", () => {
    expect(toApiPhone('01 97 45 21 38')).toBe('+2290197452138');
  });
});

describe('validation des formulaires', () => {
  it('accepte une inscription valide', () => {
    expect(
      validateSignup({ name: 'Awa Dossou', phone: '01 97 45 21 38', password: 'motdepasse1' }),
    ).toEqual({});
  });

  it('signale chaque champ invalide', () => {
    const errors = validateSignup({ name: 'A', phone: '01 97', password: 'court' });
    expect(Object.keys(errors).sort()).toEqual(['name', 'password', 'phone']);
  });

  it('connexion : exige un numéro complet et un mot de passe', () => {
    expect(validateLogin({ phone: '', password: '' })).toEqual({
      phone: '10 chiffres, commençant par 01',
      password: 'Entrez votre mot de passe',
    });
    expect(validateLogin({ phone: '01 97 45 21 38', password: 'x' })).toEqual({});
  });
});
