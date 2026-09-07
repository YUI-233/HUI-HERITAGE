type PasswordStrengthProps = {
  password: string;
};

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const characterTypes = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^\w\s]/.test(password)].filter(Boolean).length;
  const strength = password.length === 0 ? 0 : Math.min(10, Math.floor(password.length / 2) + Math.max(0, characterTypes - 1));
  const lengthMet = password.length >= 12;
  const strengthMet = strength >= 6;
  const strengthLabel = strength === 0 ? "输入密码后显示强度" : strength < 6 ? "继续加强" : strength < 8 ? "强度良好" : "强度很好";

  return <div className="password-strength" aria-live="polite"><div className="password-strength-heading"><b>密码强度</b><span>{strengthLabel}</span></div><div className="password-strength-meter" role="progressbar" aria-label="密码强度，共 10 级" aria-valuemin={0} aria-valuemax={10} aria-valuenow={strength}>{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < strength ? "active" : ""}/>)}</div><div className="password-strength-checks"><span className={lengthMet ? "met" : ""}><i>{lengthMet ? "✓" : ""}</i>长度达到 12 位</span><span className={strengthMet ? "met" : ""}><i>{strengthMet ? "✓" : ""}</i>密码强度符合要求</span></div></div>;
}
