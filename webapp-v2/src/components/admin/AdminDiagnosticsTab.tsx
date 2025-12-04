import { apiClient, type EnvironmentDiagnosticsResponse } from '@/app/apiClient';
import { Alert, Card, Stack, Typography } from '@/components/ui';
import { logError } from '@/utils/browser-logger';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

export function AdminDiagnosticsTab() {
    const { t } = useTranslation();
    const [envData, setEnvData] = useState<EnvironmentDiagnosticsResponse | null>(null);
    const [envLoading, setEnvLoading] = useState(false);
    const [envError, setEnvError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEnvData = async () => {
            setEnvLoading(true);
            setEnvError(null);
            try {
                const data = await apiClient.getEnvironmentDiagnostics();
                setEnvData(data);
            } catch (error) {
                logError('Failed to fetch environment data', error);
                setEnvError(error instanceof Error ? error.message : t('admin.diagnostics.errors.unknown'));
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
                    <div class='text-center text-indigo-600'>{t('admin.diagnostics.loading')}</div>
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
                                <Typography variant='heading' className='text-emerald-700'>{t('admin.diagnostics.serverStatus.title')}</Typography>
                            </div>
                            <div class='grid gap-4 md:grid-cols-4 text-sm'>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.serverStatus.environment')}</p>
                                    <p class='font-medium text-gray-800'>{envData.status.environment}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.serverStatus.nodeVersion')}</p>
                                    <p class='font-mono text-sm text-gray-800'>{envData.status.nodeVersion}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.serverStatus.uptime')}</p>
                                    <p class='font-medium text-gray-800'>{envData.runtime.uptimeHuman}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.serverStatus.startedAt')}</p>
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
                                <Typography variant='heading' className='text-indigo-700'>{t('admin.diagnostics.buildInfo.title')}</Typography>
                            </div>
                            <div class='grid gap-4 md:grid-cols-3 text-sm'>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.buildInfo.version')}</p>
                                    <p class='font-mono text-gray-800'>{envData.build.version}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.buildInfo.buildDate')}</p>
                                    <p class='text-gray-800'>{envData.build.date}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.buildInfo.buildTimestamp')}</p>
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
                                <Typography variant='heading' className='text-purple-700'>{t('admin.diagnostics.memory.title')}</Typography>
                            </div>
                            <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm'>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.rss')}</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.rss}</p>
                                    <p class='text-xs text-gray-600 mt-1'>{envData.status.memorySummary.rssMb} MB</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.heapUsed')}</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.heapUsed}</p>
                                    <p class='text-xs text-gray-600 mt-1'>{envData.status.memorySummary.heapUsedMb} MB</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.heapTotal')}</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.heapTotal}</p>
                                    <p class='text-xs text-gray-600 mt-1'>{envData.status.memorySummary.heapTotalMb} MB</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.heapAvailable')}</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.heapAvailable}</p>
                                </div>
                            </div>
                            <div class='grid gap-4 md:grid-cols-3 text-sm'>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.external')}</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.external}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.arrayBuffers')}</p>
                                    <p class='font-medium text-gray-800'>{envData.memory.arrayBuffers}</p>
                                </div>
                                <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.heapLimit')}</p>
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
                                    <Typography variant='heading' className='text-orange-700'>{t('admin.diagnostics.heap.title')}</Typography>
                                </div>
                                <div class='grid gap-3 md:grid-cols-2 text-sm'>
                                    {envData.memory.heapSpaces.map((space) => (
                                        <div key={space.spaceName} class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                            <p class='font-semibold text-gray-800 mb-2'>{space.spaceName}</p>
                                            <div class='space-y-1 text-xs'>
                                                <div class='flex justify-between'>
                                                    <span class='text-indigo-600'>{t('admin.diagnostics.heap.size')}</span>
                                                    <span class='font-mono text-gray-800'>{space.spaceSize}</span>
                                                </div>
                                                <div class='flex justify-between'>
                                                    <span class='text-indigo-600'>{t('admin.diagnostics.heap.used')}</span>
                                                    <span class='font-mono text-gray-800'>{space.spaceUsed}</span>
                                                </div>
                                                <div class='flex justify-between'>
                                                    <span class='text-indigo-600'>{t('admin.diagnostics.heap.available')}</span>
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
                                    <Typography variant='heading' className='text-amber-700'>{t('admin.diagnostics.envVars.title')}</Typography>
                                </div>
                                <div class='max-h-96 overflow-y-auto'>
                                    <table class='w-full text-sm'>
                                        <thead class='bg-amber-100 sticky top-0'>
                                            <tr>
                                                <th class='text-left p-2 text-amber-700 font-semibold w-1/3'>{t('admin.diagnostics.envVars.variable')}</th>
                                                <th class='text-left p-2 text-amber-700 font-semibold'>{t('admin.diagnostics.envVars.value')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(envData.env).sort(([a], [b]) => a.localeCompare(b)).map(([key, value], idx) => (
                                                <tr key={key} class={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50'}>
                                                    <td class='p-2 font-mono text-xs text-gray-800 font-semibold align-top'>{key}</td>
                                                    <td class='p-2 font-mono text-xs text-gray-600 break-all'>{value || <span class='text-gray-400 italic'>{t('common.empty')}</span>}</td>
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
                                <Typography variant='heading' className='text-teal-700'>{t('admin.diagnostics.filesystem.title')}</Typography>
                            </div>
                            <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                <p class='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.filesystem.cwd')}</p>
                                <p class='font-mono text-sm text-gray-800 break-all'>{envData.filesystem.currentDirectory}</p>
                            </div>
                            <div class='max-h-96 overflow-y-auto'>
                                <table class='w-full text-sm'>
                                    <thead class='bg-indigo-100 sticky top-0'>
                                        <tr>
                                            <th class='text-left p-2 text-indigo-700 font-semibold'>{t('common.name')}</th>
                                            <th class='text-left p-2 text-indigo-700 font-semibold'>{t('common.type')}</th>
                                            <th class='text-left p-2 text-indigo-700 font-semibold'>{t('common.size')}</th>
                                            <th class='text-left p-2 text-indigo-700 font-semibold'>{t('common.modified')}</th>
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
