"""
Testes Unitários para Services de Fazenda

Testes de validação e estrutura.
"""
import pytest
import inspect


# ========== TESTES BÁSICOS ==========
class TestEstruturaBasica:
    """Testes de estrutura básica."""
    
    def test_funcao_existe(self):
        """Função deve existir."""
        from services.fazenda_service import gerar_resumo_geral
        assert callable(gerar_resumo_geral)
    
    def test_funcao_tem_docstring(self):
        """Função deve ter docstring."""
        from services.fazenda_service import gerar_resumo_geral
        assert gerar_resumo_geral.__doc__ is not None
    
    def test_funcao_aceita_parametro(self):
        """Função deve aceitar fazenda_id."""
        from services.fazenda_service import gerar_resumo_geral
        sig = inspect.signature(gerar_resumo_geral)
        assert 'fazenda_id' in sig.parameters
    
    def test_docstring_tem_complexidade(self):
        """Docstring deve mencionar complexidade."""
        from services.fazenda_service import gerar_resumo_geral
        doc = gerar_resumo_geral.__doc__
        assert 'O(' in doc  # Deve mencionar complexidade


# ========== TESTES DE VALIDAÇÃO ==========
class TestValidacaoInput:
    """Testes de validação de entrada."""
    
    def test_id_zero_raises(self):
        """ID zero deve lançar ValueError."""
        from services.fazenda_service import gerar_resumo_geral
        with pytest.raises(ValueError):
            gerar_resumo_geral(0)
    
    def test_id_negativo_raises(self):
        """ID negativo deve lançar ValueError."""
        from services.fazenda_service import gerar_resumo_geral
        with pytest.raises(ValueError):
            gerar_resumo_geral(-1)
    
    def test_id_none_raises(self):
        """ID None deve lançar Exception."""
        from services.fazenda_service import gerar_resumo_geral
        with pytest.raises(Exception):
            gerar_resumo_geral(None)
    
    def test_id_string_raises(self):
        """ID string deve lançar Exception."""
        from services.fazenda_service import gerar_resumo_geral
        with pytest.raises(Exception):
            gerar_resumo_geral("abc")


# ========== TESTES DO APP ==========
class TestAppEndpoints:
    """Testes de integração com app."""
    
    def test_app_importa_sem_erro(self):
        """App deve importar sem erro."""
        from app import app
        assert app is not None
    
    def test_api_resumo_geral_existe(self):
        """API deve existir."""
        from app import app
        assert hasattr(app, 'view_functions')
        assert 'api_resumo_geral' in app.view_functions


# ========== EXECUÇÃO ==========
if __name__ == '__main__':
    pytest.main([__file__, '-v'])
