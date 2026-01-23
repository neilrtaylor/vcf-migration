# ODF Sizing Worked Example – Storage Only + HA

## Documented Parameters

| Parameter                    | Value                    | Notes                                            |
| ---------------------------- | ------------------------ | ------------------------------------------------ |
| Number of VMs                | 1,700                    | Average workload                                 |
| Average VM disk              | 100 GiB                  | Raw disk per VM                                  |
| Disk growth                  | 10%                      | Future expansion                                 |
| Disk virtualization overhead | 15%                      | e.g., vSAN/VMFS overhead                         |
| Node raw storage             | 25 TiB                   | Physical raw storage per node                    |
| Replica factor               | 3                        | Ceph RF=3                                        |
| Operational capacity (OpCap) | 75%                      | Maximum fraction of storage to use for workloads |
| Ceph/ODF overhead            | 15%                      | Metadata/BlueStore overhead                      |
| HA requirement               | Tolerate 2 node failures | Added after storage sizing                       |

---

## Total required usable storage

1. Base VM storage:

1,700 * 100 GiB = 170,000 GiB ~ 166 TiB

2. Add 10% growth:

166 * 1.10 ~ 182.6 TiB

3. Add 15% virtualization overhead:

182.6 * 1.15 ~ 210 TiB

**Required usable storage**: 210 TiB

---

## Max per node (after replication and Ceph overhead, before Operational Capacity)

Max per node = Raw node storage / Replica factor * (1 - Ceph overhead)

Max per node = 25 / 3 * (1 - 0.15) ~ 7.08 TiB

This represents the **maximum storage a node can hold after replication and Ceph overhead**, but before applying operational capacity limits.

---

## Usable per node with Operational Capacity

Usable per node = Max per node * Operational Capacity

Usable per node = 7.08 * 0.75 ~ 5.31 TiB

This is the value used for **storage node sizing**.

---

## Minimum nodes required (storage-only)


Nodes = Total required storage / Usable per node
Nodes = 210 / 5.31 ~ 40

**40 nodes minimum**

---

## Verify per-node utilization

Per-node allocation:

Per-node storage = 210 / 40 ~ 5.25 TiB per node

Compare to **Max per node**:

5.25 / 7.08 ~ 0.74 ~ 74%

**Less than 75% OpCap** → fits safely within operational limits

---

## Add HA requirement (2-node failure tolerance)

To tolerate 2 node failures:

Total nodes = Nodes + 2

**Total cluster nodes with HA** = 42

---

## Summary Table

| Metric                                                         | Value               |
| -------------------------------------------------------------- | ------------------- |
| Total required usable storage                                  | 210 TiB             |
| Max per node (after replication & Ceph overhead, before OpCap) | 7.08 TiB            |
| Usable per node (with 75% OpCap)                               | 5.31 TiB            |
| Minimum nodes (storage-only)                                   | 40                  |
| Per-node utilization (41 nodes)                                | 74% of max → <75%   |
| HA requirement (2-node tolerance)                              | +2 nodes            |
| Total cluster nodes with HA                                    | 42                  |

---

### Key Takeaways

1. **40 nodes** = minimum nodes to store the workload within operational limits (no overcommit).
2. **Max per node** clarifies what raw capacity exists before OpCap.
3. **Per-node utilization check** confirms 74% < 75% → safe.
4. **HA tolerance** adds 2 nodes → total **42 nodes**.
