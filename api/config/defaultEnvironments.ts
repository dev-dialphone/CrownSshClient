/**
 * Default environments that should exist on a fresh installation.
 * These are seeded only if the database has no environments.
 */
export const DEFAULT_ENVIRONMENTS = [
    {
        name: 'IVG',
        command: "echo '{{PASSWORD}}' | su -c 'cd /usr/local/freeswitch/bin/ && ps aux | grep freeswitch && pkill -9 freeswitch; sync; echo 3 > /proc/sys/vm/drop_caches; ./freeswitch'"
    },
    {
        name: 'OPS',
        command: "echo '{{PASSWORD}}' | su -c 'sudo service opensips restart && sudo systemctl restart opensips'"
    },
    {
        name: 'VOSS',
        command: "echo '{{PASSWORD}}' | su -c '/etc/init.d/mgcd restart && /etc/init.d/vos3000d restart && /etc/init.d/webserverd restart && /etc/init.d/webdatad restart && /etc/init.d/callserviced restart && /etc/init.d/servermonitord restart && /etc/init.d/mbx3000d restart && /etc/init.d/valueaddedd restart && /etc/init.d/diald restart'"
    }
];

export const getDefaultCommand = (name: string): string => {
    const env = DEFAULT_ENVIRONMENTS.find(e => e.name.toUpperCase() === name.toUpperCase());
    return env?.command || '';
};
