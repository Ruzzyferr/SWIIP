from pathlib import Path
ROOT = Path(r"c:\Users\ruzzy\OneDrive\Masaüstü\ConstChat")
page = ROOT / "apps/web/src/app/page.tsx"
fs = ROOT / "apps/web/src/components/landing/FeatureShowcase.tsx"
t = page.read_text(encoding="utf-8")
t = t.replace(
    "import { motion, useScroll, useTransform, useInView } from 'framer-motion';",
    "import { motion, useInView } from 'framer-motion';",
)
old_scroll = """  const scrollRef = useRef<HTMLDivElement>(null!);
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.18], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.18], [1, 0.96]);

"""
t = t.replace(old_scroll, "")
t = t.replace(
    "<div ref={scrollRef} className=\"h-screen overflow-y-auto\" style={{ background: 'var(--color-surface-base)' }}>",
    "<div className=\"min-h-[100dvh] overflow-x-hidden\" style={{ background: 'var(--color-surface-base)' }}>",
)
print("scroll removed", "useScroll" not in t)
page.write_text(t, encoding="utf-8")
