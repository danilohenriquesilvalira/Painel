import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '../services/api';
import {
  Plus, RefreshCw, Search, Edit, Trash2,
  Ruler
} from 'lucide-react';
import {
  Card,
  CardBody,
  Button,
  Pagination,
  Input,
  Tooltip,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  SortDescriptor
} from '@heroui/react';
import type { PlcData, BitConfig } from '../types';
import {
  AddBitConfigForm,
  EditBitModal,
  useToast
} from '../components';

interface PaginaBitsProps {
  isConnected: boolean;
  plcData: PlcData | null;
}

const columns = [
  { name: 'BIT / MENSAGEM', uid: 'name', sortable: true },
  { name: 'STATUS PLC', uid: 'status_plc' },
  { name: 'CONFIGURAÇÃO', uid: 'config', sortable: true },
  { name: 'PRIORIDADE', uid: 'priority', sortable: true },
  { name: 'POSIÇÃO', uid: 'position', sortable: true },
  { name: 'AÇÕES', uid: 'actions' },
];

export const PaginaBits: React.FC<PaginaBitsProps> = ({
  isConnected,
  plcData
}) => {
  const [bitConfigs, setBitConfigs] = useState<BitConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddBitForm, setShowAddBitForm] = useState(false);
  const [filterValue, setFilterValue] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Estado para o modal de edição
  const [editingBit, setEditingBit] = useState<BitConfig | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { toast, confirm } = useToast();

  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'priority',
    direction: 'ascending',
  });

  useEffect(() => {
    loadBitConfigs();
  }, []);

  const loadBitConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const bitConfigsData = await invoke<BitConfig[]>('get_all_bit_configs');
      setBitConfigs(bitConfigsData);
    } catch (error) {
      console.error('Erro ao carregar configurações de bits:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addNewBitConfig = async (bitConfig: any) => {
    try {
      await invoke('add_bit_config', {
        ...bitConfig,
        actionType: 'text',
        videoId: null,
      });
      setShowAddBitForm(false);
      await loadBitConfigs();
      toast('success', 'Configuração de bit adicionada com sucesso!');
    } catch (error) {
      toast('error', `Erro ao adicionar: ${error}`);
    }
  };

  // Funções para o modal de edição
  const handleEditBit = useCallback((bitConfig: BitConfig) => {
    setEditingBit(bitConfig);
    setShowEditModal(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setEditingBit(null);
    setShowEditModal(false);
  }, []);

  const handleUpdateBit = async (updatedBit: any) => {
    if (!editingBit) return;
    try {
      await invoke('update_bit_config', {
        wordIndex: editingBit.word_index,
        bitIndex: editingBit.bit_index,
        ...updatedBit,
        messageOff: '',
        actionType: 'text',
        videoId: null,
      });
      handleCloseEditModal();
      await loadBitConfigs();
      toast('success', 'Configuração atualizada com sucesso!');
    } catch (error) {
      toast('error', `Erro ao atualizar: ${error}`);
    }
  };

  // Estatísticas
  const activeBits = bitConfigs.filter(b => b.enabled).length;
  const inactiveBits = bitConfigs.filter(b => !b.enabled).length;

  // Filtragem e Ordenação
  const filteredItems = useMemo(() => {
    let filtered = [...bitConfigs];
    if (filterValue) {
      const search = filterValue.toLowerCase();
      filtered = filtered.filter(bit =>
        bit.name.toLowerCase().includes(search) ||
        bit.message.toLowerCase().includes(search) ||
        `${bit.word_index}.${bit.bit_index}`.includes(search)
      );
    }
    return filtered;
  }, [bitConfigs, filterValue]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a: any, b: any) => {
      let first = a[sortDescriptor.column as keyof BitConfig];
      let second = b[sortDescriptor.column as keyof BitConfig];

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

  /* --- Render Cell Functions --- */
  const renderCell = useCallback((bitConfig: BitConfig, columnKey: React.Key) => {

    switch (columnKey) {
      case 'name':
        return (
          <div className="flex items-start space-x-3 group min-w-[200px]">
            <div
              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 transition-all duration-300 group-hover:scale-125 shadow-sm"
              style={{ backgroundColor: bitConfig.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-edp-marine truncate font-sans tracking-tight">{bitConfig.name}</p>
                <div className="px-1.5 py-0.5 rounded border border-edp-neutral-lighter/50 bg-edp-neutral-white-tint">
                  <span className="text-[9px] font-mono text-edp-slate opacity-80 block leading-none">
                    W{bitConfig.word_index}.{bitConfig.bit_index}
                  </span>
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-edp-slate truncate max-w-[220px] font-medium opacity-80">{bitConfig.message || '(sem mensagem)'}</p>
            </div>
          </div>
        );
      case 'status_plc':
        const isBitActive = (() => {
          if (!plcData?.variables) return false;
          const wordKey = `Word[${bitConfig.word_index}]`;
          const wordValue = plcData.variables[wordKey] || 0;
          return ((wordValue >> bitConfig.bit_index) & 1) === 1;
        })();

        return (
          <div className="flex items-center justify-center">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-500
              ${isBitActive
                ? "bg-edp-electric/10 border-edp-electric/30 shadow-[0_0_10px_rgba(40,255,82,0.2)]"
                : "bg-edp-neutral-white-wash border-edp-neutral-lighter/60 opacity-50"
              }
            `}>
              <div className={`
                w-2 h-2 rounded-full transition-all duration-300
                ${isBitActive ? "bg-edp-electric shadow-[0_0_6px_rgba(40,255,82,1)] animate-pulse" : "bg-edp-neutral-medium"}
              `} />
            </div>
          </div>
        );
      case 'config':
        return (
          <div className="flex items-center justify-center">
            <div className={`
              flex items-center justify-center px-3 h-6 rounded-full border transition-all duration-300 min-w-[70px]
              ${bitConfig.enabled
                ? "bg-edp-marine/5 border-edp-marine/20 text-edp-marine"
                : "bg-edp-neutral-white-wash border-edp-neutral-lighter text-edp-neutral-medium"
              }
            `}>
              <span className="text-[9px] font-bold tracking-widest font-sans uppercase leading-none">
                {bitConfig.enabled ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        );
      case 'priority':
        return (
          <div className="flex justify-center">
            <span className="font-tabular text-[11px] font-bold text-edp-marine bg-edp-neutral-white-tint border border-edp-neutral-lighter/60 rounded px-2 py-0.5 min-w-[32px] text-center shadow-sm">
              {bitConfig.priority}
            </span>
          </div>
        );
      case 'position':
        return (
          <div className="flex flex-col items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1 text-[9px] text-edp-marine font-bold uppercase tracking-widest font-sans leading-none">
              <span className="opacity-60">{bitConfig.position === 'top' ? 'Topo' : bitConfig.position === 'center' ? 'Centro' : 'Base'}</span>
            </div>
            <div className="flex items-center gap-1 text-[8px] text-edp-neutral-medium font-mono bg-edp-neutral-white-wash px-1.5 py-0.5 rounded border border-edp-neutral-lighter/50 leading-none">
              <Ruler size={8} />
              <span>{bitConfig.font_size}px</span>
            </div>
          </div>
        );
      case 'actions':
        return (
          <div className="relative flex justify-end items-center gap-2">
            <Tooltip content="Editar" className="text-xs bg-edp-marine text-white">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => handleEditBit(bitConfig)}
                className="text-edp-slate hover:text-edp-marine hover:bg-edp-neutral-white-wash rounded-lg w-9 h-9 min-w-9 transition-all"
              >
                <Edit size={16} />
              </Button>
            </Tooltip>
            <Tooltip content="Deletar" color="danger" className="text-xs">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                className="text-edp-semantic-red hover:bg-edp-semantic-light-red w-9 h-9 min-w-9 rounded-lg transition-all"
                onPress={async () => {
                  const confirmed = await confirm({
                    title: 'Deletar Configuração',
                    message: `Tem certeza que deseja deletar "${bitConfig.name}"?`,
                    confirmLabel: 'Deletar',
                    danger: true,
                  });
                  if (confirmed) {
                    try {
                      await invoke('delete_bit_config', { wordIndex: bitConfig.word_index, bitIndex: bitConfig.bit_index });
                      loadBitConfigs();
                      toast('success', 'Configuração deletada!');
                    } catch (error) {
                      toast('error', `Erro ao deletar: ${error}`);
                    }
                  }
                }}
              >
                <Trash2 size={16} />
              </Button>
            </Tooltip>
          </div>
        );
      default: return null;
    }
  }, [plcData, handleEditBit, confirm, toast, loadBitConfigs]);

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
            <Button
              isIconOnly
              size="md"
              variant="flat"
              onPress={() => loadBitConfigs()}
              className="bg-white border border-edp-neutral-lighter text-edp-slate hover:text-edp-marine hover:bg-edp-neutral-white-tint rounded-lg h-10 w-10 transition-all hover:border-edp-marine"
              isLoading={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </Button>

            <Button
              className="bg-edp-marine text-white font-medium shadow-sm hover:bg-edp-marine-100 rounded-lg h-10 px-4 flex items-center gap-2 transition-all"
              size="md"
              startContent={<Plus size={16} />}
              onPress={() => setShowAddBitForm(true)}
            >
              <span className="hidden sm:inline">Novo Bit</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }, [filterValue, isLoading, loadBitConfigs]);

  const BottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 flex flex-col sm:flex-row justify-between items-center mt-2 border-t border-edp-neutral-lighter/20 pt-4 gap-2">
        <span className="text-[11px] text-edp-slate font-medium hidden sm:inline-block">
          {filteredItems.length > 0
            ? `${(page - 1) * rowsPerPage + 1}-${Math.min(page * rowsPerPage, filteredItems.length)} de ${filteredItems.length} configurações`
            : "0 configurações"}
        </span>
        <div className="flex w-full md:w-auto justify-center md:justify-end">
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
    <div className="w-full h-full flex flex-col space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full flex-shrink-0">
        <Card className="border border-edp-neutral-lighter/60 shadow-sm bg-white" shadow="none" radius="lg">
          <CardBody className="p-4">
            <p className="text-xs font-medium text-edp-slate uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-bold text-edp-marine font-tabular">{bitConfigs.length}</p>
          </CardBody>
        </Card>
        <Card className="border border-edp-neutral-lighter/60 shadow-sm bg-white" shadow="none" radius="lg">
          <CardBody className="p-4">
            <p className="text-xs font-medium text-edp-slate uppercase tracking-wider mb-1">Ativos</p>
            <p className="text-2xl font-bold text-edp-marine font-tabular">{activeBits}</p>
          </CardBody>
        </Card>
        <Card className="border border-edp-neutral-lighter/60 shadow-sm bg-white" shadow="none" radius="lg">
          <CardBody className="p-4">
            <p className="text-xs font-medium text-edp-slate uppercase tracking-wider mb-1">Inativos</p>
            <p className="text-2xl font-black text-edp-slate font-tabular font-sans">{inactiveBits}</p>
          </CardBody>
        </Card>
        <Card className={`border shadow-sm bg-white ${isConnected ? 'border-edp-marine' : 'border-edp-semantic-red/30'}`} shadow="none" radius="lg">
          <CardBody className="p-4">
            <p className="text-xs font-medium text-edp-slate uppercase tracking-wider mb-1">Status PLC</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-edp-electric animate-pulse" : "bg-edp-semantic-red"}`} />
              <p className={`text-lg font-bold font-tabular ${isConnected ? 'text-edp-marine' : 'text-edp-semantic-red'}`}>
                {isConnected ? 'Online' : 'Offline'}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tabela Principal */}
      <Card className="border border-edp-neutral-lighter shadow-sm bg-white overflow-hidden w-full flex-1 flex flex-col min-h-0" shadow="none" radius="lg">
        <CardBody className="p-4 sm:p-6 w-full flex-1 overflow-hidden flex flex-col">
          <Table
            aria-label="Tabela de Configurações de Bits"
            isHeaderSticky
            bottomContent={BottomContent}
            bottomContentPlacement="outside"
            topContent={TopContent}
            topContentPlacement="outside"
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
            classNames={{
              wrapper: "h-full shadow-none p-0 bg-transparent gap-0 w-full overflow-x-auto",
              th: "bg-edp-neutral-white-wash text-edp-marine text-[10px] font-bold uppercase tracking-widest h-10 border-b border-edp-neutral-lighter first:rounded-l-lg last:rounded-r-lg px-4",
              td: "py-3 border-b border-edp-neutral-white-tint last:border-none group-data-[hover=true]:bg-edp-neutral-white-wash/60 transition-colors cursor-default align-middle px-4",
              table: "min-w-full",
            }}
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn
                  key={column.uid}
                  align={column.uid === 'actions' ? 'end' : column.uid === 'name' ? 'start' : 'center'}
                  allowsSorting={column.sortable}
                  className={column.uid === 'actions' ? 'w-10' : ''}
                >
                  {column.name}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={items}
              emptyContent={"Nenhuma configuração encontrada."}
              isLoading={isLoading}
              loadingContent={
                <div className="w-full flex flex-col gap-4 p-4 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 w-full animate-pulse opacity-100">
                      <div className="w-8 h-8 rounded-full bg-edp-neutral-lighter" />
                      <div className="h-3 w-3/4 rounded-lg bg-edp-neutral-lighter" />
                    </div>
                  ))}
                </div>
              }
            >
              {(item) => (
                <TableRow key={item.id}>
                  {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Modal de Edição */}
      {showEditModal && editingBit && (
        <EditBitModal
          bitConfig={editingBit}
          onSave={handleUpdateBit}
          onClose={handleCloseEditModal}
          plcData={plcData}
        />
      )}

      {/* Modal Novo Bit */}
      {showAddBitForm && (
        <AddBitConfigForm
          onAdd={addNewBitConfig}
          onCancel={() => setShowAddBitForm(false)}
          plcData={plcData}
          existingConfigs={bitConfigs}
        />
      )}
    </div>
  );
};
