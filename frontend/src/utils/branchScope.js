export function getBranchScope() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const branchAccess = user?.branchAccess ?? user?.branch_access;
    return branchAccess && branchAccess !== 'all' ? String(branchAccess) : '';
  } catch {
    return '';
  }
}

export function isDedicatedBranchUser() {
  return Boolean(getBranchScope());
}

export function filterBranches(branches = []) {
  const scope = getBranchScope();
  if (!scope) return branches;
  return branches.filter(branch => String(branch.id) === scope);
}

export function filterBranchItems(items = []) {
  const scope = getBranchScope();
  if (!scope) return items;
  return items.filter(item => String(item.branch_id) === scope);
}
