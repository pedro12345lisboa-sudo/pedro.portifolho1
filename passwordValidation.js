/* ============================================================
   Pedro Sites — passwordValidation.js (Front-end)
   Validação e criptografia de senhas no cliente
   ============================================================ */

"use strict";

class PasswordValidator {
  constructor(apiUrl = "/api/auth") {
    this.apiUrl = apiUrl;
    this.minLength = 8;
    this.requirements = {
      lowercase: /[a-z]/,
      uppercase: /[A-Z]/,
      numbers: /[0-9]/,
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
    };
  }

  /**
   * Valida força da senha LOCALMENTE
   */
  validateStrength(password) {
    if (!password) {
      return {
        isValid: false,
        score: 0,
        strength: "muito fraca",
        errors: ["Nenhuma senha fornecida"],
        passedTests: []
      };
    }

    const errors = [];
    const passedTests = [];

    // Comprimento
    if (password.length >= this.minLength) {
      passedTests.push("✓ Mínimo 8 caracteres");
    } else {
      errors.push(`✗ Mínimo ${this.minLength} caracteres`);
    }

    // Letras minúsculas
    if (this.requirements.lowercase.test(password)) {
      passedTests.push("✓ Letra minúscula");
    } else {
      errors.push("✗ Pelo menos 1 letra minúscula");
    }

    // Letras maiúsculas
    if (this.requirements.uppercase.test(password)) {
      passedTests.push("✓ Letra maiúscula");
    } else {
      errors.push("✗ Pelo menos 1 letra maiúscula");
    }

    // Números
    if (this.requirements.numbers.test(password)) {
      passedTests.push("✓ Número");
    } else {
      errors.push("✗ Pelo menos 1 número");
    }

    // Caracteres especiais
    if (this.requirements.special.test(password)) {
      passedTests.push("✓ Caractere especial");
    } else {
      errors.push("✗ Pelo menos 1 caractere especial: !@#$%^&*()");
    }

    // Calcula score
    const score = this.calculateScore(password);
    
    // Determina força
    let strength = "muito fraca";
    if (score >= 80) strength = "muito forte";
    else if (score >= 60) strength = "forte";
    else if (score >= 40) strength = "moderada";
    else if (score >= 20) strength = "fraca";

    return {
      isValid: errors.length === 0,
      score,
      strength,
      errors,
      passedTests
    };
  }

  /**
   * Calcula score (0-100)
   */
  calculateScore(password) {
    let score = 0;

    if (!password) return score;

    // Comprimento
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;

    // Diversidade
    if (this.requirements.lowercase.test(password)) score += 15;
    if (this.requirements.uppercase.test(password)) score += 15;
    if (this.requirements.numbers.test(password)) score += 15;
    if (this.requirements.special.test(password)) score += 15;

    // Penalidades
    if (/(.)\\1{2,}/.test(password)) score -= 10; // Caracteres repetidos
    if (/^[a-z]+$/.test(password)) score -= 15; // Apenas minúsculas
    if (/^\\d+$/.test(password)) score -= 15; // Apenas números

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Valida via API (para confirmar no servidor)
   */
  async validateWithServer(password) {
    try {
      const response = await fetch(`${this.apiUrl}/validate-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        throw new Error(`Erro: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[PasswordValidator] Erro na validação:", error);
      return {
        success: false,
        message: "Erro ao validar com servidor"
      };
    }
  }

  /**
   * Verifica tentativas de login
   */
  async checkLoginAttempts(email) {
    try {
      const response = await fetch(`${this.apiUrl}/check-attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      return await response.json();
    } catch (error) {
      console.error("[PasswordValidator] Erro ao verificar tentativas:", error);
      return { success: false, blocked: false };
    }
  }

  /**
   * Registra uma tentativa de login
   */
  async recordLoginAttempt(email) {
    try {
      await fetch(`${this.apiUrl}/record-attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
    } catch (error) {
      console.error("[PasswordValidator] Erro ao registrar tentativa:", error);
    }
  }

  /**
   * CRIPTOGRAFIA END-TO-END
   * Criptografa senha antes de enviar
   * Usa SubtleCrypto (Web Crypto API)
   */
  async encryptPassword(password, secret) {
    try {
      // Gera IV aleatório (12 bytes para GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Derived key do secret
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );

      const derivedKey = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: crypto.getRandomValues(new Uint8Array(16)),
          iterations: 100000,
          hash: "SHA-256"
        },
        keyMaterial,
        256
      );

      // Encrypta com AES-GCM
      const key = await crypto.subtle.importKey(
        "raw",
        derivedKey,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
      );

      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(password)
      );

      // Retorna tudo em base64
      const result = {
        iv: this.arrayToBase64(iv),
        encrypted: this.arrayToBase64(new Uint8Array(encrypted))
      };

      return result;
    } catch (error) {
      console.error("[PasswordValidator] Erro ao criptografar:", error);
      return null;
    }
  }

  /**
   * Converte Uint8Array para Base64
   */
  arrayToBase64(array) {
    let binary = "";
    for (let i = 0; i < array.byteLength; i++) {
      binary += String.fromCharCode(array[i]);
    }
    return btoa(binary);
  }

  /**
   * Converte Base64 para Uint8Array
   */
  base64ToArray(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

// Exporta para uso global
window.PasswordValidator = PasswordValidator;
