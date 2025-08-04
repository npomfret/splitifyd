/**
 * Helper function to get a selector by role
 */
export function getByRole(page: any, selector: { role: string; name: string | RegExp; exact?: boolean }) {
  return page.getByRole(selector.role, { 
    name: selector.name, 
    exact: selector.exact 
  });
}
/**
 * Helper function to get a selector by text
 */
export function getByText(page: any, selector: { text: string | RegExp }) {
  return page.getByText(selector.text);
}'A'.repeat(100);
