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
        <div className='space-y-6'>
            {/* Server Diagnostics */}
            {envLoading && (
                <Card padding='lg' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                    <div className='text-center text-indigo-600'>{t('admin.diagnostics.loading')}</div>
                </Card>
            )}

            {envError && <Alert type='error' message={envError} />}

            {envData && (
                <>
                    {/* Status Overview */}
                    <Card padding='lg' data-testid='env-status-card' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                        <Stack spacing='sm'>
                            <div className='flex items-center gap-2 mb-2'>
                                <div className='w-1 h-6 bg-linear-to-b from-green-500 to-emerald-600 rounded-full'></div>
                                <Typography variant='heading' className='text-emerald-700'>{t('admin.diagnostics.serverStatus.title')}</Typography>
                            </div>
                            <div className='grid gap-4 md:grid-cols-4 text-sm'>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.serverStatus.environment')}</p>
                                    <p className='font-medium text-gray-800'>{envData.status.environment}</p>
                                </div>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.serverStatus.nodeVersion')}</p>
                                    <p className='font-mono text-sm text-gray-800'>{envData.status.nodeVersion}</p>
                                </div>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.serverStatus.uptime')}</p>
                                    <p className='font-medium text-gray-800'>{envData.runtime.uptimeHuman}</p>
                                </div>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.serverStatus.startedAt')}</p>
                                    <p className='text-xs text-gray-800'>{new Date(envData.runtime.startTime).toLocaleString()}</p>
                                </div>
                            </div>
                        </Stack>
                    </Card>

                    {/* Build Information */}
                    <Card padding='lg' data-testid='env-build-card' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                        <Stack spacing='sm'>
                            <div className='flex items-center gap-2 mb-2'>
                                <div className='w-1 h-6 bg-linear-to-b from-blue-500 to-indigo-600 rounded-full'></div>
                                <Typography variant='heading' className='text-indigo-700'>{t('admin.diagnostics.buildInfo.title')}</Typography>
                            </div>
                            <div className='grid gap-4 md:grid-cols-3 text-sm'>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.buildInfo.version')}</p>
                                    <p className='font-mono text-gray-800'>{envData.build.version}</p>
                                </div>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.buildInfo.buildDate')}</p>
                                    <p className='text-gray-800'>{envData.build.date}</p>
                                </div>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.buildInfo.buildTimestamp')}</p>
                                    <p className='font-mono text-xs text-gray-800'>{envData.build.timestamp}</p>
                                </div>
                            </div>
                        </Stack>
                    </Card>

                    {/* Memory Summary */}
                    <Card padding='lg' data-testid='env-memory-card' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                        <Stack spacing='md'>
                            <div className='flex items-center gap-2 mb-2'>
                                <div className='w-1 h-6 bg-linear-to-b from-purple-500 to-pink-600 rounded-full'></div>
                                <Typography variant='heading' className='text-purple-700'>{t('admin.diagnostics.memory.title')}</Typography>
                            </div>
                            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm'>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.rss')}</p>
                                    <p className='font-medium text-gray-800'>{envData.memory.rss}</p>
                                    <p className='text-xs text-gray-600 mt-1'>{envData.status.memorySummary.rssMb} MB</p>
                                </div>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.heapUsed')}</p>
                                    <p className='font-medium text-gray-800'>{envData.memory.heapUsed}</p>
                                    <p className='text-xs text-gray-600 mt-1'>{envData.status.memorySummary.heapUsedMb} MB</p>
                                </div>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.heapTotal')}</p>
                                    <p className='font-medium text-gray-800'>{envData.memory.heapTotal}</p>
                                    <p className='text-xs text-gray-600 mt-1'>{envData.status.memorySummary.heapTotalMb} MB</p>
                                </div>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.heapAvailable')}</p>
                                    <p className='font-medium text-gray-800'>{envData.memory.heapAvailable}</p>
                                </div>
                            </div>
                            <div className='grid gap-4 md:grid-cols-3 text-sm'>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.external')}</p>
                                    <p className='font-medium text-gray-800'>{envData.memory.external}</p>
                                </div>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.arrayBuffers')}</p>
                                    <p className='font-medium text-gray-800'>{envData.memory.arrayBuffers}</p>
                                </div>
                                <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                    <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.memory.heapLimit')}</p>
                                    <p className='font-medium text-gray-800'>{envData.memory.heapLimit}</p>
                                </div>
                            </div>
                        </Stack>
                    </Card>

                    {/* Heap Spaces */}
                    {envData.memory.heapSpaces.length > 0 && (
                        <Card padding='lg' data-testid='env-heap-spaces-card' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                            <Stack spacing='md'>
                                <div className='flex items-center gap-2 mb-2'>
                                    <div className='w-1 h-6 bg-linear-to-b from-orange-500 to-red-600 rounded-full'></div>
                                    <Typography variant='heading' className='text-orange-700'>{t('admin.diagnostics.heap.title')}</Typography>
                                </div>
                                <div className='grid gap-3 md:grid-cols-2 text-sm'>
                                    {envData.memory.heapSpaces.map((space) => (
                                        <div key={space.spaceName} className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                            <p className='font-semibold text-gray-800 mb-2'>{space.spaceName}</p>
                                            <div className='space-y-1 text-xs'>
                                                <div className='flex justify-between'>
                                                    <span className='text-indigo-600'>{t('admin.diagnostics.heap.size')}</span>
                                                    <span className='font-mono text-gray-800'>{space.spaceSize}</span>
                                                </div>
                                                <div className='flex justify-between'>
                                                    <span className='text-indigo-600'>{t('admin.diagnostics.heap.used')}</span>
                                                    <span className='font-mono text-gray-800'>{space.spaceUsed}</span>
                                                </div>
                                                <div className='flex justify-between'>
                                                    <span className='text-indigo-600'>{t('admin.diagnostics.heap.available')}</span>
                                                    <span className='font-mono text-gray-800'>{space.spaceAvailable}</span>
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
                        <Card padding='lg' data-testid='env-variables-card' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                            <Stack spacing='md'>
                                <div className='flex items-center gap-2 mb-2'>
                                    <div className='w-1 h-6 bg-linear-to-b from-amber-500 to-yellow-600 rounded-full'></div>
                                    <Typography variant='heading' className='text-amber-700'>{t('admin.diagnostics.envVars.title')}</Typography>
                                </div>
                                <div className='max-h-96 overflow-y-auto'>
                                    <table className='w-full text-sm'>
                                        <thead className='bg-amber-100 sticky top-0'>
                                            <tr>
                                                <th className='text-left p-2 text-amber-700 font-semibold w-1/3'>{t('admin.diagnostics.envVars.variable')}</th>
                                                <th className='text-left p-2 text-amber-700 font-semibold'>{t('admin.diagnostics.envVars.value')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(envData.env).sort(([a], [b]) => a.localeCompare(b)).map(([key, value], idx) => (
                                                <tr key={key} class={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50'}>
                                                    <td className='p-2 font-mono text-xs text-gray-800 font-semibold align-top'>{key}</td>
                                                    <td className='p-2 font-mono text-xs text-gray-600 break-all'>{value || <span className='text-gray-400 italic'>{t('common.empty')}</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Stack>
                        </Card>
                    )}

                    {/* Filesystem Information */}
                    <Card padding='lg' data-testid='env-filesystem-card' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                        <Stack spacing='md'>
                            <div className='flex items-center gap-2 mb-2'>
                                <div className='w-1 h-6 bg-linear-to-b from-teal-500 to-cyan-600 rounded-full'></div>
                                <Typography variant='heading' className='text-teal-700'>{t('admin.diagnostics.filesystem.title')}</Typography>
                            </div>
                            <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                                <p className='text-indigo-600 text-xs mb-1'>{t('admin.diagnostics.filesystem.cwd')}</p>
                                <p className='font-mono text-sm text-gray-800 break-all'>{envData.filesystem.currentDirectory}</p>
                            </div>
                            <div className='max-h-96 overflow-y-auto'>
                                <table className='w-full text-sm'>
                                    <thead className='bg-indigo-100 sticky top-0'>
                                        <tr>
                                            <th className='text-left p-2 text-indigo-700 font-semibold'>{t('common.name')}</th>
                                            <th className='text-left p-2 text-indigo-700 font-semibold'>{t('common.type')}</th>
                                            <th className='text-left p-2 text-indigo-700 font-semibold'>{t('common.size')}</th>
                                            <th className='text-left p-2 text-indigo-700 font-semibold'>{t('common.modified')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {envData.filesystem.files.map((file, idx) => (
                                            <tr key={idx} class={idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50'}>
                                                <td className='p-2 font-mono text-xs text-gray-800'>{file.name}</td>
                                                <td className='p-2 text-gray-600'>{file.type || '—'}</td>
                                                <td className='p-2 font-mono text-xs text-gray-600'>{file.size || '—'}</td>
                                                <td className='p-2 text-xs text-gray-600'>{file.modified ? new Date(file.modified).toLocaleString() : '—'}</td>
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
