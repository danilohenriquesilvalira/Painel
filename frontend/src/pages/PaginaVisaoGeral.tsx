import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity, Database, Zap,
  AlertTriangle, Info, AlertCircle, XCircle,
  Search, RefreshCw, Download, Filter,
  ChevronDown, Eye
} from 'lucide-react';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Pagination,
  Input,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  SortDescriptor,
  Skeleton
} from '@heroui/react';
import type { PlcData, SystemLog } from '../types';
import { invoke } from '../services/api';

interface PaginaVisaoGeralProps {
  isConnected: boolean;
  lastUpdate: Date | null;
  plcData: PlcData | null;
}

// Definição das colunas com comportamento responsivo inteligente
const columns = [
  { name: 'STATUS', uid: 'level', sortable: true },
  { name: 'EVENTO', uid: 'message', sortable: true },
  { name: 'CATEGORIA', uid: 'category', sortable: true },
  { name: 'DATA & HORA', uid: 'timestamp', sortable: true },
  { name: 'AÇÕES', uid: 'actions' },
];

export const PaginaVisaoGeral: React.FC<PaginaVisaoGeralProps> = ({
  isConnected,
  lastUpdate,
  plcData
}) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [page, setPage] = useState(1);
  const [filterLevel, setFilterLevel] = useState<string>('todos');
  const [filterValue, setFilterValue] = useState('');
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'timestamp',
    direction: 'descending',
  });

  const rowsPerPage = 8;

  useEffect(() => {
    loadLogs();

    // Polling inteligente
    const interval = setInterval(() => {
      loadLogs(false);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadLogs = async (showLoadingState = true) => {
    if (showLoadingState) setLoadingLogs(true);
    try {
      const recentLogs = await invoke<SystemLog[]>('get_recent_logs', { limit: 100 });
      setLogs(recentLogs);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      if (showLoadingState) setLoadingLogs(false);
    }
  };

  const filteredItems = useMemo(() => {
    let filteredLogs = [...logs];

    if (filterLevel !== 'todos') {
      filteredLogs = filteredLogs.filter(log => log.level === filterLevel);
    }

    if (filterValue) {
      const search = filterValue.toLowerCase();
      filteredLogs = filteredLogs.filter(log =>
        log.message.toLowerCase().includes(search) ||
        log.category.toLowerCase().includes(search) ||
        log.details?.toLowerCase().includes(search)
      );
    }

    return filteredLogs;
  }, [logs, filterLevel, filterValue]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a: any, b: any) => {
      const first = a[sortDescriptor.column as keyof SystemLog];
      const second = b[sortDescriptor.column as keyof SystemLog];
      const cmp = first < second ? -1 : first > second ? 1 : 0;

      return sortDescriptor.direction === 'descending' ? -cmp : cmp;
    });
  }, [filteredItems, sortDescriptor]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);
  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return sortedItems.slice(start, end);
  }, [page, sortedItems, rowsPerPage]);

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'critical': return <XCircle size={18} />;
      case 'error': return <AlertCircle size={18} />;
      case 'warning': return <AlertTriangle size={18} />;
      default: return <Info size={18} />;
    }
  };

  const renderCell = useCallback((log: SystemLog, columnKey: React.Key) => {
    const cellValue = log[columnKey as keyof SystemLog];

    switch (columnKey) {
      case 'level':
        return (
          <div className={`
              flex items-center justify-center w-8 h-8 rounded-full shadow-sm flex-shrink-0
              ${log.level === 'critical' || log.level === 'error' ? 'bg-edp-semantic-light-red/40 text-edp-semantic-red shadow-edp-semantic-red/20' :
              log.level === 'warning' ? 'bg-edp-semantic-light-yellow/40 text-edp-semantic-yellow shadow-edp-semantic-yellow/20' :
                'bg-edp-neutral-white-wash text-edp-slate'}
            `}>
            {getLogIcon(log.level)}
          </div>
        );
      case 'message':
        return (
          <div className="flex flex-col py-1 min-w-[150px]">
            <p className="text-sm font-semibold text-edp-marine leading-snug truncate">
              {log.message}
            </p>
            {/* Mobile metadata stack */}
            <div className="flex items-center gap-2 mt-1 sm:hidden">
              <span className="text-[10px] text-edp-slate font-tabular">
                {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {log.category && (
                <span className="text-[9px] font-bold text-edp-slate uppercase bg-edp-neutral-white-wash px-1 rounded">
                  {log.category}
                </span>
              )}
            </div>

            {log.details && (
              <span className="hidden sm:inline-block text-[10px] text-edp-neutral-darker mt-0.5 truncate max-w-[200px] lg:max-w-[300px] font-mono bg-edp-neutral-white-wash px-1.5 py-0.5 rounded border border-edp-neutral-lighter w-max">
                {log.details}
              </span>
            )}
          </div>
        );
      case 'category':
        return (
          <Chip
            variant="flat"
            size="sm"
            classNames={{
              base: "bg-edp-marine-100/10 h-6 border border-edp-marine/20",
              content: "text-[9px] font-bold text-edp-marine uppercase tracking-wider px-1"
            }}
          >
            {cellValue as string}
          </Chip>
        );
      case 'timestamp':
        const date = new Date(log.timestamp);
        return (
          <div className="flex flex-col">
            <span className="text-xs font-tabular font-semibold text-edp-marine">
              {date.toLocaleDateString('pt-BR')}
            </span>
            <span className="text-[10px] font-tabular text-edp-slate">
              {date.toLocaleTimeString('pt-BR')}
            </span>
          </div>
        );
      case 'actions':
        return (
          <div className="relative flex justify-end items-center">
            <Tooltip content="Ver detalhes" placement="left" className="text-xs font-medium bg-edp-marine text-white">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="text-edp-slate hover:text-edp-marine hover:bg-edp-neutral-white-wash rounded-lg w-9 h-9 min-w-9 transition-all"
              >
                <Eye size={16} />
              </Button>
            </Tooltip>
          </div>
        );
      default:
        return cellValue as React.ReactNode;
    }
  }, []);

  const metricas = [
    {
      titulo: 'Status Conexão',
      valor: isConnected ? 'Online' : 'Offline',
      subtext: isConnected ? 'Sistema operante' : 'Verifique a rede',
      icone: <Zap size={20} className={isConnected ? "text-edp-electric" : "text-white"} />,
      bgIcon: isConnected ? "bg-edp-marine" : "bg-edp-semantic-red",
    },
    {
      titulo: 'Sincronização',
      valor: lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : '--:--',
      subtext: 'Em tempo real',
      icone: <Activity size={20} className="text-edp-ice" />,
      bgIcon: "bg-edp-marine",
    },
    {
      titulo: 'Variáveis PLC',
      valor: plcData ? String(Object.keys(plcData.variables).length) : '0',
      subtext: 'Tags ativas',
      icone: <Database size={20} className="text-edp-electric-200" />,
      bgIcon: "bg-edp-marine",
    },
  ];

  const TopContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col md:flex-row justify-between gap-3 items-end md:items-center">
          <Input
            isClearable
            classNames={{
              base: "w-full md:max-w-[40%]",
              inputWrapper: "border border-edp-neutral-lighter hover:border-edp-marine focus-within:border-edp-marine shadow-sm bg-white rounded-lg h-10 transition-all px-3",
              input: "text-sm text-edp-marine placeholder:text-edp-slate",
            }}
            placeholder="Buscar vídeos..."
            size="sm"
            startContent={<Search className="text-edp-slate" size={16} />}
            value={filterValue}
            onClear={() => setFilterValue("")}
            onValueChange={setFilterValue}
          />
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <Dropdown>
              <DropdownTrigger>
                <Button
                  endContent={<ChevronDown size={14} className="text-edp-slate" />}
                  variant="flat"
                  size="md"
                  className="bg-white border border-edp-neutral-lighter text-edp-marine font-medium shadow-sm rounded-lg h-10 px-3 hover:border-edp-marine transition-all"
                >
                  <span className="hidden sm:inline">{filterLevel === 'todos' ? 'Todos' : filterLevel}</span>
                  <span className="sm:hidden"><Filter size={16} /></span>
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                disallowEmptySelection
                aria-label="Filtro de Nível"
                closeOnSelect={true}
                selectedKeys={new Set([filterLevel])}
                selectionMode="single"
                onSelectionChange={(keys) => setFilterLevel(Array.from(keys)[0] as string)}
              >
                <DropdownItem key="todos" className="text-edp-marine">Todos</DropdownItem>
                <DropdownItem key="critical" className="text-edp-semantic-red">Crítico</DropdownItem>
                <DropdownItem key="error" className="text-edp-semantic-red">Erro</DropdownItem>
                <DropdownItem key="warning" className="text-edp-semantic-yellow">Aviso</DropdownItem>
              </DropdownMenu>
            </Dropdown>

            <Button
              isIconOnly
              size="md"
              variant="flat"
              onPress={() => loadLogs(true)}
              className="bg-white border border-edp-neutral-lighter text-edp-slate hover:text-edp-marine hover:bg-edp-neutral-white-tint rounded-lg h-10 w-10 transition-all hover:border-edp-marine"
            >
              <RefreshCw size={16} className={loadingLogs ? "animate-spin" : ""} />
            </Button>

            <Button
              className="bg-edp-marine text-white font-medium shadow-sm hover:bg-edp-marine-100 rounded-lg h-10 px-4 flex items-center gap-2 transition-all"
              size="md"
              startContent={<Download size={16} />}
            >
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }, [filterValue, filterLevel, loadingLogs]);

  const BottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 flex flex-col sm:flex-row justify-between items-center mt-2 border-t border-edp-neutral-lighter/20 pt-4 gap-2">
        <span className="text-[11px] text-edp-slate font-medium hidden sm:inline-block">
          {filteredItems.length > 0
            ? `${(page - 1) * rowsPerPage + 1}-${Math.min(page * rowsPerPage, filteredItems.length)} de ${filteredItems.length}`
            : "0 registros"}
        </span>
        <div className="w-full sm:w-auto flex justify-center">
          <Pagination
            showControls
            isCompact
            color="primary"
            page={page}
            total={pages || 1}
            onChange={setPage}
            classNames={{
              cursor: "bg-edp-marine shadow-md shadow-edp-marine/20",
              item: "bg-white border border-transparent hover:bg-edp-neutral-white-wash text-edp-neutral-darker font-medium text-xs rounded-lg",
            }}
          />
        </div>
      </div>
    );
  }, [filteredItems.length, page, pages]);

  return (
    <div className="w-full h-full flex flex-col space-y-6">
      {/* ===== METRIC CARDS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {metricas.map((m, idx) => (
          <Card
            key={idx}
            className="border border-edp-neutral-lighter/60 shadow-sm hover:shadow-lg transition-all duration-300 bg-white overflow-hidden w-full"
            radius="lg"
            shadow="none"
          >
            <CardBody className="p-5 flex flex-row items-center gap-4 relative z-10 w-full overflow-hidden">
              <div className={`
                p-3 rounded-xl shadow-lg transition-transform duration-500 group-hover:scale-110 flex-shrink-0
                ${m.bgIcon}
              `}>
                {m.icone}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <p className="text-[10px] font-bold text-edp-slate uppercase tracking-wider mb-0.5 opacity-80 truncate">
                  {m.titulo}
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold text-edp-marine font-tabular tracking-tight truncate">
                    {m.valor}
                  </h3>
                </div>
                <p className="text-[10px] text-edp-neutral-darker font-medium mt-1 truncate">
                  {m.subtext}
                </p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* ===== LOGS TABLE ===== */}
      <Card className="border border-edp-neutral-lighter shadow-sm bg-white overflow-hidden w-full flex-1 flex flex-col min-h-0" shadow="none" radius="lg">
        <CardBody className="p-4 sm:p-6 w-full flex-1 overflow-hidden flex flex-col">
          <Table
            aria-label="Tabela de logs do sistema"
            isHeaderSticky
            bottomContent={BottomContent}
            bottomContentPlacement="outside"
            classNames={{
              wrapper: "h-full shadow-none p-0 bg-transparent gap-0 w-full overflow-x-auto",
              th: "bg-edp-neutral-white-wash text-edp-marine text-[10px] font-bold uppercase tracking-widest h-10 first:rounded-l-lg last:rounded-r-lg border-b border-edp-neutral-lighter px-4",
              td: "py-3 border-b border-edp-neutral-white-tint last:border-none group-data-[hover=true]:bg-edp-neutral-white-wash/60 transition-colors cursor-default px-4",
              table: "min-w-full",
              tbody: "divide-y divide-edp-neutral-white-tint/0",
            }}
            selectionMode="single"
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
            topContent={TopContent}
            topContentPlacement="outside"
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn
                  key={column.uid}
                  align={column.uid === 'actions' ? 'end' : 'start'}
                  allowsSorting={column.sortable}
                  className={
                    column.uid === 'category' || column.uid === 'timestamp'
                      ? "hidden md:table-cell"
                      : column.uid === 'actions'
                        ? "w-10"
                        : ""
                  }
                >
                  {column.name}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={loadingLogs ? [] : items}
              emptyContent={!loadingLogs && "Nenhum log encontrado."}
              isLoading={loadingLogs}
              loadingContent={
                <div className="w-full flex flex-col gap-4 p-4 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 w-full animate-pulse opacity-100">
                      <Skeleton className="rounded-full w-8 h-8 flex-shrink-0 bg-edp-neutral-lighter" />
                      <div className="flex flex-col gap-2 w-full">
                        <Skeleton className="h-3 w-3/4 rounded-lg bg-edp-neutral-lighter" />
                        <Skeleton className="h-2 w-1/2 rounded-lg bg-edp-neutral-lighter/60" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-lg bg-edp-neutral-lighter hidden sm:block" />
                    </div>
                  ))}
                </div>
              }
            >
              {(item) => (
                <TableRow key={item.id} className="group transition-colors duration-200">
                  {(columnKey) => (
                    <TableCell className={
                      columnKey === 'category' || columnKey === 'timestamp'
                        ? "hidden md:table-cell"
                        : ""
                    }>
                      {renderCell(item, columnKey)}
                    </TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
};

export default PaginaVisaoGeral;
