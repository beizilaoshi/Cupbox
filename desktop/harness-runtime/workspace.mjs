import path from 'node:path';
export const name='cupbox-workspace';
export const inject=['workspaceRegistry'];
export async function apply(ctx){
 // Register the directory the user already selected in Cupbox. This creates
 // only the upstream project record; it never starts a task or edits the project.
 await ctx.workspaceRegistry.create(process.cwd(),path.basename(process.cwd()));
}
