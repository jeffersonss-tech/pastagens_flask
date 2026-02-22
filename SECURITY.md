# POLÍTICA DE SEGURANÇA - PastoFlow
=====================================

Última atualização: Fevereiro 2026

## 1. REPORTANDO VULNERABILIDADES

Se você descobrir uma vulnerabilidade de segurança no PastoFlow, agradecemos
sua ajuda para proteger nossos usuários. Por favor, relate o problema
de forma responsável.

### Como reportar:

**Email:** jeffersonssantos92@gmail.com

**Assunto:** [SECURITY] - Descrição breve da vulnerabilidade

**Inclua na report:**
- Descrição da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Screenshots (se aplicável)

### O que esperar:

- Confirmação de recebimento em até 48 horas
- Atualização sobre o progresso da correção
- Crédito público na seção de agradecimentos (se desejado)

---

## 2. PRÁTICAS DE SEGURANÇA DO DESENVOLVIMENTO

### Autenticação
- Senhas hasheadas com Werkzeug (PBKDF2)
- Session management seguro
- Timeout de sessão automático

### Autorização (RBAC)
- Sistema de permissões baseado em roles
- Isolamento de dados por fazenda
- Verificação em todas as rotas protegidas

### Banco de Dados
- Consultas parametrizadas (previne SQL Injection)
- Isolamento de dados por usuário

### Boas Práticas
- Atualizações regulares de dependências
- Código revisado antes de merge
- Logs de auditoria

---

## 3. USO COMERCIAL - REQUISITOS DE SEGURANÇA

Clientes com licença comercial devem:

- **Armazenamento seguro:** Manter credenciais em local seguro
- **Acesso restrito:** Limitar acesso ao sistema a pessoas autorizadas
- **HTTPS:** Usar conexão segura em produção
- **Backup:** Manter backups regulares do banco de dados
- **Monitoramento:** Monitorar acessos e atividades suspeitas
- **Reportar:** Reportar imediatamente qualquer incidente de segurança

---

## 4. INCIDENTES DE SEGURANÇA

Em caso de incidente de segurança:

1. Imediatamente alterar todas as senhas
2. Contatar o suporte: jeffersonssantos92@gmail.com
3. Documentar o incidente
4. Cooperar com investigação

---

## 5. ISENÇÃO DE RESPONSABILIDADE

O PastoFlow é fornecido "como está". Embora nos comprometamos
com a segurança, não garantimos que o software seja livre de falhas.

---

# SECURITY POLICY - PastoFlow
================================

Last updated: February 2026

## 1. REPORTING VULNERABILITIES

If you discover a security vulnerability in PastoFlow, we appreciate your
help in protecting our users. Please report the issue responsibly.

### How to report:

**Email:** jeffersonssantos92@gmail.com

**Subject:** [SECURITY] - Brief description of vulnerability

**Include in report:**
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Screenshots (if applicable)

### What to expect:

- Acknowledgment within 48 hours
- Update on fix progress
- Public credit in acknowledgments (if desired)

---

## 2. SECURITY PRACTICES

### Authentication
- Passwords hashed with Werkzeug (PBKDF2)
- Secure session management
- Automatic session timeout

### Authorization (RBAC)
- Role-based permission system
- Farm data isolation
- Verification on all protected routes

### Database
- Parameterized queries (prevents SQL Injection)
- Per-user data isolation

### Best Practices
- Regular dependency updates
- Code review before merge
- Audit logs

---

## 3. COMMERCIAL USE - SECURITY REQUIREMENTS

Clients with commercial license must:

- **Secure storage:** Keep credentials in a safe place
- **Restricted access:** Limit system access to authorized personnel
- **HTTPS:** Use secure connection in production
- **Backup:** Maintain regular database backups
- **Monitoring:** Monitor for suspicious activity
- **Report:** Immediately report any security incident

---

## 4. SECURITY INCIDENTS

In case of security incident:

1. Immediately change all passwords
2. Contact support: jeffersonssantos92@gmail.com
3. Document the incident
4. Cooperate with investigation

---

## 5. DISCLAIMER

PastoFlow is provided "as is". While we are committed to security,
we do not guarantee that the software is free of flaws.
