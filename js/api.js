// JSONBin API wrapper
const API = {
    baseUrl: 'https://api.jsonbin.io/v3',
    apiKey: '$2a$10$hm7J97lLcGQCE9NGfef8ReIVgLddJrgsro7DJE14.vYdD.b01my1e',
    
    // Create a new bin (project)
    async createBin(data) {
        Utils.log('Creating new bin', data);
        
        try {
            const response = await fetch(`${this.baseUrl}/b`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey,
                    'X-Bin-Name': data.name || 'Fair Split Project'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to create project: ${error}`);
            }

            const result = await response.json();
            Utils.log('Bin created successfully', result);
            return {
                id: result.metadata.id,
                data: result.record
            };
        } catch (error) {
            Utils.log('Error creating bin', error);
            throw error;
        }
    },

    // Read a bin (project)
    async readBin(binId) {
        Utils.log(`Reading bin: ${binId}`);
        
        // Validate bin ID format
        if (!Utils.isValidJsonBinId(binId)) {
            throw new Error('Invalid Bin Id provided');
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/b/${binId}/latest`, {
                method: 'GET',
                headers: {
                    'X-Master-Key': this.apiKey
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Project not found');
                }
                const error = await response.text();
                throw new Error(`Failed to read project: ${error}`);
            }

            const result = await response.json();
            Utils.log('Bin read successfully', result);
            return result.record;
        } catch (error) {
            Utils.log('Error reading bin', error);
            throw error;
        }
    },

    // Update a bin (project)
    async updateBin(binId, data) {
        Utils.log(`Updating bin: ${binId}`, data);
        
        // Validate bin ID format
        if (!Utils.isValidJsonBinId(binId)) {
            throw new Error('Invalid Bin Id provided');
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/b/${binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to update project: ${error}`);
            }

            const result = await response.json();
            Utils.log('Bin updated successfully', result);
            return result.record;
        } catch (error) {
            Utils.log('Error updating bin', error);
            throw error;
        }
    },

    // Retry logic for API calls
    async withRetry(fn, maxRetries = 3) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                Utils.log(`API call failed, attempt ${i + 1}/${maxRetries}`, error);
                
                // Don't retry on 404s
                if (error.message.includes('not found')) {
                    throw error;
                }
                
                // Exponential backoff
                if (i < maxRetries - 1) {
                    const delay = Math.pow(2, i) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }
};