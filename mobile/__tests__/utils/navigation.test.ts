import { backOrHome } from '../../src/utils/navigation';

function router(podeVoltar: boolean) {
  return { canGoBack: jest.fn(() => podeVoltar), back: jest.fn(), replace: jest.fn() };
}

describe('backOrHome', () => {
  it('com tela atras, volta', () => {
    const r = router(true);
    backOrHome(r);
    expect(r.back).toHaveBeenCalledTimes(1);
    expect(r.replace).not.toHaveBeenCalled();
  });

  it('aberta como primeira tela (link direto, recarregamento), vai para a Hoje em vez de GO_BACK sem destino', () => {
    const r = router(false);
    backOrHome(r);
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith('/');
  });
});
