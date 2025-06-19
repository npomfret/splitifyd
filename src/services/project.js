import { generateId } from '../utils/helpers.js';
import { detectDefaultCurrency } from '../utils/currency.js';

export class ProjectService {
    createProject(name, userName) {
        const projectId = generateId('fairsplit');
        const userId = generateId('user');
        
        return {
            id: projectId,
            name: name,
            defaultCurrency: detectDefaultCurrency(),
            members: [
                { id: userId, name: userName }
            ],
            expenses: [],
            version: 1,
            lastUpdated: Date.now(),
            userId: userId
        };
    }

    addMember(project, memberName) {
        const newMember = {
            id: generateId('user'),
            name: memberName
        };
        
        project.members.push(newMember);
        project.version++;
        project.lastUpdated = Date.now();
        
        return newMember;
    }

    mergeProjects(localProject, remoteProject) {
        // If remote is newer, use it
        if (remoteProject.version > localProject.version) {
            return { ...remoteProject };
        }
        
        // If versions are equal but remote was updated more recently
        if (remoteProject.version === localProject.version && 
            remoteProject.lastUpdated > localProject.lastUpdated) {
            return { ...remoteProject };
        }
        
        // Otherwise keep local
        return localProject;
    }

    validateProject(project) {
        if (!project || typeof project !== 'object') {
            throw new Error('Invalid project data');
        }
        
        if (!project.id || !project.name) {
            throw new Error('Project must have ID and name');
        }
        
        if (!Array.isArray(project.members) || project.members.length === 0) {
            throw new Error('Project must have at least one member');
        }
        
        if (!Array.isArray(project.expenses)) {
            throw new Error('Project must have expenses array');
        }
        
        return true;
    }
}