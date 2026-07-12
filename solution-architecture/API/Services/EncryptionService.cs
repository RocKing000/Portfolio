using System.Security.Cryptography;
using System.Text;

namespace EnterpriseChatbot.API.Services;

public interface IEncryptionService
{
    string Encrypt(string plainText, string encryptionKey);
    string Decrypt(string encryptedText, string encryptionKey);
    string GetDateBasedKey();
    string GetDateBasedKey(DateTime date);
    string HashPasswordMD5(string input);
}

public class EncryptionService : IEncryptionService
{
    // AES-GCM encrypt → Base64(nonce[12] + ciphertext[N] + tag[16])
    public string Encrypt(string plainText, string encryptionKey)
    {
        var keyBytes  = NormalizeKey(encryptionKey);
        var nonce     = new byte[12];
        RandomNumberGenerator.Fill(nonce);

        var plainBytes  = Encoding.UTF8.GetBytes(plainText);
        var cipherBytes = new byte[plainBytes.Length];
        var tag         = new byte[16];

        using var aes = new AesGcm(keyBytes, 16);
        aes.Encrypt(nonce, plainBytes, cipherBytes, tag);

        var combined = new byte[12 + plainBytes.Length + 16];
        nonce.CopyTo(combined, 0);
        cipherBytes.CopyTo(combined, 12);
        tag.CopyTo(combined, 12 + plainBytes.Length);

        return Convert.ToBase64String(combined);
    }

    // AES-GCM decrypt — expects Base64(nonce[12] + ciphertext[N] + tag[16])
    public string Decrypt(string encryptedText, string encryptionKey)
    {
        var keyBytes = NormalizeKey(encryptionKey);
        var combined = Convert.FromBase64String(encryptedText);

        var nonce       = combined[..12];
        var tag         = combined[^16..];
        var cipherBytes = combined[12..^16];
        var plainBytes  = new byte[cipherBytes.Length];

        using var aes = new AesGcm(keyBytes, 16);
        aes.Decrypt(nonce, cipherBytes, tag, plainBytes);

        return Encoding.UTF8.GetString(plainBytes);
    }

    // DDMMYYYYDDMMYYYYDDMMYYYYDDMMYYYY — 32 chars, rotates daily
    public string GetDateBasedKey() => GetDateBasedKey(DateTime.Now);

    public string GetDateBasedKey(DateTime date)
    {
        var segment = $"{date.Day:D2}{date.Month:D2}{date.Year:D4}"; // 8 chars
        return string.Concat(segment, segment, segment, segment);    // 32 chars
    }

    // MD5(input) → uppercase hex with hyphens: "A1-B2-C3-..."
    // Used for password hashing: input = username + plainPassword
    public string HashPasswordMD5(string input)
    {
        var bytes  = MD5.HashData(Encoding.ASCII.GetBytes(input));
        var sb     = new StringBuilder(47);
        for (int i = 0; i < bytes.Length; i++)
        {
            if (i > 0) sb.Append('-');
            sb.Append(bytes[i].ToString("X2"));
        }
        return sb.ToString();
    }

    // Pad or truncate to exactly 32 bytes for AES-256
    private static byte[] NormalizeKey(string key)
    {
        var padded = key.PadRight(32, '0')[..32];
        return Encoding.UTF8.GetBytes(padded);
    }
}
