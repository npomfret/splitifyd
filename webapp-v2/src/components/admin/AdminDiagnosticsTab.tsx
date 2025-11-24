import { Alert, Card, Stack, Typography } from '@/components/ui';
import { logError } from '@/utils/browser-logger';
import { useEffect, useState } from 'preact/hooks';

interface EnvPayload {
    status: {
        timestamp: string;
        environment: string;
        nodeVersion: string;
        uptimeSeconds: number;
        memorySummary: {
            rssMb: number;
            heapUsedMb: number;
            heapTotalMb: number;
            externalMb: number;
        };
    };
    env: Record<string, string | undefined>;
    build: {
        timestamp: string;
        date: string;
        version: string;
    };
    runtime: {
        startTime: string;
        uptime: number;
        uptimeHuman: string;
    };
    memory: {
        rss: string;
        heapTotal: string;
        heapUsed: string;
        external: string;
        arrayBuffers: string;
        heapAvailable: string;
        heapLimit: string;
        totalHeapSize: string;
        totalHeapExecutableSize: string;
        totalPhysicalSize: string;
        totalAvailableSize: string;
        mallocedMemory: string;
        peakMallocedMemory: string;
        heapSpaces: Array<{
            spaceName: string;
            spaceSize: string;
            spaceUsed: string;
            spaceAvailable: string;
            physicalSize: string;
        }>;
    };
    filesystem: {
        currentDirectory: string;
        files: Array<{
            name: string;
            type?: string;
            size?: string | null;
            modified?: string;
            mode?: string;
            isSymbolicLink?: boolean;
            error?: string;
        }>;
    };
}

export function AdminDiagnosticsTab() {
    const [envData, setEnvData] = useState<EnvPayload | null>(null);
    const [envLoading, setEnvLoading] = useState(false);
    const [envError, setEnvError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEnvData = async () => {
            setEnvLoading(true);
            setEnvError(null);
            try {
                const response = await fetch('/api/env');
                if (!response.ok) {
                    if (response.status === 404) {
                        setEnvError('Environment diagnostics are only available in non-production environments');
                    } else {
                        setEnvError(`Failed to fetch environment data: ${response.statusText}`);
                    }
                    return;
                }
                const data = await response.json();
                setEnvData(data);
            } catch (error) {
                logError('Failed to fetch environment data', error);
                setEnvError(error instanceof Error ? error.message : 'Unknown error occurred');
            } finally {
                setEnvLoading(false);
            }
        };

        fetchEnvData();
    }, []);

    return (
        <div class='space-y-6'>
            {/* Server Diagnostics */}
            {envLoading && (
                <Card padding='lg' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                    <div class='text-center text-indigo-600'>Loading environment diagnostics...</div>
                </Card>
            )}

            {envError && <Alert type='error' message={envError} />}

            {envData && (
                <>
                    {/* Status Overview */}
                    <Card padding='lg' data-testid='env-status-card' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                        <Stack spacing='sm'>
                            <div class='flex items-center gap-2 mb-2'>
                                <div class='w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full'></div>
                                <Typography variant='heading' className='text-emerald-700'>Server Status</Typography>
                            </div>
                            <div class='grid gap-4 md:grid-cols-4 text-sm'>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Environment</p>
                                    <p class='font-medium text-gray-800'>{envData.status.environment}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Node Version</p>
                                    <p class='font-mono text-sm text-gray-800'>{envData.status.nodeVersion}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Uptime</p>
                                    <p class='font-medium text-gray-800'>{envData.runtime.uptimeHuman}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Started At</p>
                                    <p class='text-xs text-gray-800'>{new Date(envData.runtime.startTime).toLocaleString()}</p>
                                </div>
                            </div>
                        </Stack>
                    </Card>

                    {/* Build Information */}
                    <Card padding='lg' data-testid='env-build-card' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                        <Stack spacing='sm'>
                            <div class='flex items-center gap-2 mb-2'>
                                <div class='w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full'></div>
                                <Typography variant='heading' className='text-indigo-700'>Build Information</Typography>
                            </div>
                            <div class='grid gap-4 md:grid-cols-3 text-sm'>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Version</p>
                                    <p class='font-mono text-gray-800'>{envData.build.version}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Build Date</p>
                                    <p class='text-gray-800'>{envData.build.date}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Build Timestamp</p>
                                    <p class='font-mono text-xs text-gray-800'>{envData.build.timestamp}</p>
                                </div>
                            </div>
                        </Stack>
                    </Card>

                    {/* Memory Summary */}
                    <Card padding='lg' data-testid='env-memory-card' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                        <Stack spacing='md'>
                            <div class='flex items-center gap-2 mb-2'>
                                <div class='w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-600 rounded-full'></div>
                                <Typography variant='heading' className='text-purple-700'>Memory Usage</Typography>
                            </div>
                            <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm'>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>RSS (Resident Set Size)</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.rss}</p>
                                    <p class='text-xs text-gray-600 mt-1'>{envData.status.memorySummary.rssMb} MB</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Heap Used</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.heapUsed}</p>
                                    <p class='text-xs text-gray-600 mt-1'>{envData.status.memorySummary.heapUsedMb} MB</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Heap Total</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.heapTotal}</p>
                                    <p class='text-xs text-gray-600 mt-1'>{envData.status.memorySummary.heapTotalMb} MB</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Heap Available</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.heapAvailable}</p>
                                </div>
                            </div>
                            <div class='grid gap-4 md:grid-cols-3 text-sm'>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>External Memory</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.external}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Array Buffers</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.arrayBuffers}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>Heap Limit</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.heapLimit}</p>
                                </div>
                            </div>
                        </Stack>
                    </Card>

                    {/* Heap Spaces */}
                    {envData.memory.heapSpaces.length > 0 && (
                        <Card padding='lg' data-testid='env-heap-spaces-card' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                            <Stack spacing='md'>
                                <div class='flex items-center gap-2 mb-2'>
                                    <div class='w-1 h-6 bg-gradient-to-b from-orange-500 to-red-600 rounded-full'></div>
                                    <Typography variant='heading' className='text-orange-700'>V8 Heap Spaces</Typography>
                                </div>
                                <div class='grid gap-3 md:grid-cols-2 text-sm'>
                                    {envData.memory.heapSpaces.map((space) => (
                                        <div key={space.spaceName} class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                            <p class='font-semibold text-gray-800 mb-2'>{space.spaceName}</p>
                                            <div class='space-y-1 text-xs'>
                                                <div class='flex justify-between'>
                                                    <span class='text-indigo-600'>Size:</span>
                                                    <span class='font-mono text-gray-800'>{space.spaceSize}</span>
                                                </div>
                                                <div class='flex justify-between'>
                                                    <span class='text-indigo-600'>Used:</span>
                                                    <span class='font-mono text-gray-800'>{space.spaceUsed}</span>
                                                </div>
                                                <div class='flex justify-between'>
                                                    <span class='text-indigo-600'>Available:</span>
                                                    <span class='font-mono text-gray-800'>{space.spaceAvailable}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Stack>
                        </Card>
                    )}

                    {/* Environment Variables */}
                    {envData.env && Object.keys(envData.env).length > 0 && (
                        <Card padding='lg' data-testid='env-variables-card' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                            <Stack spacing='md'>
                                <div class='flex items-center gap-2 mb-2'>
                                    <div class='w-1 h-6 bg-gradient-to-b from-amber-500 to-yellow-600 rounded-full'></div>
                                    <Typography variant='heading' className='text-amber-700'>Environment Variables</Typography>
                                </div>
                                <div class='max-h-96 overflow-y-auto'>
                                    <table class='w-full text-sm'>
                                        <thead class='bg-amber-100 sticky top-0'>
                                            <tr>
                                                <th class='text-left p-2 text-amber-700 font-semibold w-1/3'>Variable</th>
                                                <th class='text-left p-2 text-amber-700 font-semibold'>Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(envData.env).sort(([a], [b]) => a.localeCompare(b)).map(([key, value], idx) => (
                                                <tr key={key} class={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50'}>
                                                    <td class='p-2 font-mono text-xs text-gray-800 font-semibold align-top'>{key}</td>
                                                    <td class='p-2 font-mono text-xs text-gray-600 break-all'>{value || <span class='text-gray-400 italic'>(empty)</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Stack>
                        </Card>
                    )}

                    {/* Filesystem Information */}
                    <Card padding='lg' data-testid='env-filesystem-card' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                        <Stack spacing='md'>
                            <div class='flex items-center gap-2 mb-2'>
                                <div class='w-1 h-6 bg-gradient-to-b from-teal-500 to-cyan-600 rounded-full'></div>
                                <Typography variant='heading' className='text-teal-700'>Filesystem</Typography>
                            </div>
                            <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                <p class='text-indigo-600 text-xs mb-1'>Working Directory</p>
                                <p class='font-mono text-sm text-gray-800 break-all'>{envData.filesystem.currentDirectory}</p>
                            </div>
                            <div class='max-h-96 overflow-y-auto'>
                                <table class='w-full text-sm'>
                                    <thead class='bg-indigo-100 sticky top-0'>
                                        <tr>
                                            <th class='text-left p-2 text-indigo-700 font-semibold'>Name</th>
                                            <th class='text-left p-2 text-indigo-700 font-semibold'>Type</th>
                                            <th class='text-left p-2 text-indigo-700 font-semibold'>Size</th>
                                            <th class='text-left p-2 text-indigo-700 font-semibold'>Modified</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {envData.filesystem.files.map((file, idx) => (
                                            <tr key={idx} class={idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50'}>
                                                <td class='p-2 font-mono text-xs text-gray-800'>{file.name}</td>
                                                <td class='p-2 text-gray-600'>{file.type || '—'}</td>
                                                <td class='p-2 font-mono text-xs text-gray-600'>{file.size || '—'}</td>
                                                <td class='p-2 text-xs text-gray-600'>{file.modified ? new Date(file.modified).toLocaleString() : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Stack>
                    </Card>
                </>
            )}
        </div>
    );
}
