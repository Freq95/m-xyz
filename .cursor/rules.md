# Cursor AI Rules for Vecinu

## Before Starting Work

1. **READ** `CLAUDE.md` for current status and task list
2. **FOLLOW** `.claude/rules.md` for coding patterns

---

## Your Role

- You implement features from "Current Task" list in CLAUDE.md
- You CANNOT mark tasks as complete (Claude will verify)
- You MUST add to "Pending Review" section when done

---

## After Each Session

Update `CLAUDE.md` "Pending Review" section with:

```markdown
### Cursor Session [DATE]
**Files Changed:**
- path/to/file.ts - what changed

**Self-Reported Issues:**
- Any problems encountered

**Build Status:** PASSING / FAILING

**Needs Review:**
- [ ] Follows patterns in .claude/rules.md
- [ ] No regressions to auth flow
```

---

## DO NOT

- Start work not listed in "Current Task"
- Mark tasks as complete
- Modify `.claude/rules.md` without discussion
- Skip build verification (`npm run build`)
- Commit broken code

---

## Commands

```bash
# Before ending session
npm run build
npx tsc --noEmit

# Start dev server
npm run dev
```

---

## Reference

See `.claude/rules.md` for:
- API route patterns
- Validation patterns
- Error handling
- Security requirements
- Romanian message requirements
