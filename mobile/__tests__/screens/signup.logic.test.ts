// Testa a lógica de detecção de email duplicado no signup
// Supabase não retorna erro para email existente — retorna user com identities: []

type SignUpData = {
  user: { identities: { id: string }[] | null } | null;
} | null;

function isEmailAlreadyRegistered(data: SignUpData): boolean {
  return Array.isArray(data?.user?.identities) && data.user!.identities.length === 0;
}

describe('isEmailAlreadyRegistered', () => {
  it('retorna true quando identities é array vazio (email já cadastrado)', () => {
    expect(isEmailAlreadyRegistered({ user: { identities: [] } })).toBe(true);
  });

  it('retorna false quando identities tem itens (cadastro novo legítimo)', () => {
    expect(isEmailAlreadyRegistered({ user: { identities: [{ id: 'abc' }] } })).toBe(false);
  });

  it('retorna false quando user é null', () => {
    expect(isEmailAlreadyRegistered({ user: null })).toBe(false);
  });

  it('retorna false quando data é null', () => {
    expect(isEmailAlreadyRegistered(null)).toBe(false);
  });

  it('retorna false quando identities é null', () => {
    expect(isEmailAlreadyRegistered({ user: { identities: null } })).toBe(false);
  });
});
