# 🧹 Unused Code Detection

This project uses **knip** for accurate unused code detection across the monorepo.

## 🚀 Quick Start

```bash
# Analyze all workspaces
npm run check:unused

# Analyze specific workspace
npm run check:unused:webapp
npm run check:unused:functions
npm run check:unused:shared
npm run check:unused:test-support

# Targeted analysis
npm run check:unused:exports      # Only unused exports
npm run check:unused:dependencies # Only unused dependencies
npm run check:unused:files        # Only unused files
npm run check:unused:production   # Production code only
```

## 📊 What Knip Finds

- **Unused files** - Files never imported
- **Unused exports** - Exported functions/types never used
- **Unused dependencies** - Packages in package.json not imported
- **Unused devDependencies** - Dev packages not used
- **Unlisted binaries** - CLI tools used but not in dependencies
- **Duplicate exports** - Same export from multiple places

## ⚙️ Configuration

Knip is configured in `knip.json` at the root level with workspace-specific settings:

- **Entry points** - Where analysis starts (main.tsx, index.ts, etc.)
- **Project files** - What files to analyze
- **Ignore patterns** - What to skip (tests, dist, node_modules)
- **Dependencies to ignore** - Known safe dependencies (@types/*, etc.)

## 🎯 Cleanup Strategy

### High Priority ✅
1. Remove unused files identified by knip
2. Remove unused exports from component index files
3. Clean up unused type definitions
4. Remove genuinely unused dependencies

### Medium Priority ⚠️
1. Review API schemas marked as unused (may be used for validation)
2. Check store types (might be internal-only)
3. Verify test utilities before removal

### Low Priority 📝
1. Organize internal-only exports
2. Add missing binary dependencies
3. Review devDependencies usage

## 🔧 Why We Switched from ts-prune

**ts-prune issues:**
- ❌ 98% false positive rate due to path alias resolution issues
- ❌ Couldn't handle `@/*` import mappings
- ❌ Limited to exports only
- ❌ In maintenance mode (archived)

**knip benefits:**
- ✅ Accurate path alias resolution
- ✅ Comprehensive analysis (files, deps, exports, types)
- ✅ Framework-aware (Vite, Preact, monorepo)
- ✅ Actively maintained with modern TypeScript support

## 📈 Results

Before (ts-prune): 602 "unused" items → 98% false positives
After (knip): 30 genuinely unused items → 0% false positives

See `knip-analysis.md` for detailed comparison and findings.