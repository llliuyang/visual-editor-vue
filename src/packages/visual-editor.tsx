import { computed, defineComponent, PropType, ref } from "vue";
import '@/packages/visual-editor.scss'
import { createNewBlock, VisualEditorBlockData, VisualEditorComponent, VisualEditorConfig, VisualEditorModelValue } from "./visual-editor.utils";
import { useModel } from "./utils/useModel";
import { VisualEditorBlock } from "./visual-editor-block";
import { useVisualCommand } from "./utils/visual-command";
import { createEvent } from "./plugins/event";
import { $$dialog } from "./utils/dialog-service";
import { ElMessageBox } from "element-plus";
export const VisualEditor = defineComponent({
  props: {
    modelValue: { type: Object as PropType<VisualEditorModelValue>, required: true },
    config: { type: Object as PropType<VisualEditorConfig>, required: true }
  },
  emits: {
    'update:modelValue': (val?: VisualEditorModelValue) => true
  },
  setup(props, ctx) {

    /* 双向绑定至，容器中组建的数据 */
    const dataModel = useModel(() => props.modelValue, val => ctx.emit('update:modelValue', val));

    /* container节点dom的引用 */
    const containerRef = ref({} as HTMLDivElement);

    /* container 节点的 style 样式对象 */
    const containerStyles = computed(() => ({
      width: `${dataModel.value.container.width}px`,
      height: `${dataModel.value.container.height}px`
    }));
    // console.log(props.config)

    /* 计算选中与未选中的block数据 */
    const focusData = computed(() => {
      let focus: VisualEditorBlockData[] = [];
      let unFocus: VisualEditorBlockData[] = [];
      (dataModel.value.blocks || []).forEach(block => (block.focus ? focus : unFocus).push(block));
      return {
        focus,
        unFocus
      }
    });

    const dragstart = createEvent();
    const dragend = createEvent();

    // dragstart.on(() => {console.log('dragstart')});
    // dragend.on(() => {console.log('dragend')});

    /* 对外暴露的一些方法 */
    const methods = {
      clearFocus: (block?: VisualEditorBlockData) => {
        let blocks = (dataModel.value.blocks || []);
        if (blocks.length === 0) return;
        if (!!block) {
          blocks = blocks.filter(item => item !== block)
        }
        blocks.forEach(block => block.focus = false)
      },
      updateBlocks: (blocks?: VisualEditorBlockData[]) => {
        dataModel.value = {
          ...dataModel.value,
          blocks
        }
      }
    };

    /* 处理从菜单拖拽组件到容器的相关动作 */
    const menuDraggier = (() => {
      let component = null as null | VisualEditorComponent;
      const blockHandler = {
        /**
         * 处理拖拽菜单组件开始动作
         */
        dragstart: (e: DragEvent, current: VisualEditorComponent) => {
          containerRef.value.addEventListener('dragenter', containerHandler.dragenter);
          containerRef.value.addEventListener('dragover', containerHandler.dragover);
          containerRef.value.addEventListener('dragleave', containerHandler.dragleave);
          containerRef.value.addEventListener('drop', containerHandler.drop);
          component = current;
          dragstart.emit()
        },
        /**
         * 处理拖拽菜单结束动作
         */
        dragend: () => {
          containerRef.value.removeEventListener('dragenter', containerHandler.dragenter);
          containerRef.value.removeEventListener('dragover', containerHandler.dragover);
          containerRef.value.removeEventListener('dragleave', containerHandler.dragleave);
          containerRef.value.removeEventListener('drop', containerHandler.drop);
          component = null
        },
      };

      const containerHandler = {
        /* 拖拽菜单组件进入容器的时候，设置鼠标为可放置状态 */
        dragenter: (e: DragEvent) => e.dataTransfer!.dropEffect = 'move',
        /* 拖拽菜单组件在容器中移动时候，禁用默认事件 */
        dragover: (e: DragEvent) => e.preventDefault(),
        /* 如果拖拽过程中鼠标离开了容器，设置鼠标为不可放置状态 */
        dragleave: (e: DragEvent) => e.dataTransfer!.dropEffect = 'none',
        /* 在容器中放置的时候，通过事件对象的offsetX、offsetY添加一条组件数据 */
        drop: (e: DragEvent) => {
          const blocks = [...dataModel.value.blocks || []];
          blocks.push(createNewBlock({
            component: component!,
            top: e.offsetY,
            left: e.offsetX
          }))
          methods.updateBlocks(blocks);
          dragend.emit()
        }
      }
      return blockHandler
    })();

    /* 处理 block 选中的相关动作 */
    const focusHandler = (() => {
      return {
        container: {
          onMouseDown: (e: MouseEvent) => {
            e.preventDefault();
            if (e.currentTarget !== e.target) return;
            /* 点击空白处，清空选中的block */
            if (!e.shiftKey) {
              methods.clearFocus();
            }
          }
        },
        block: {
          onMouseDown: (e: MouseEvent, block: VisualEditorBlockData) => {
            if (e.shiftKey) {
              if (focusData.value.focus.length <= 1) {
                block.focus = true
              } else {
                block.focus = !block.focus;
              }
            } else {
              if (!block.focus) {
                block.focus = true;
                methods.clearFocus(block);
              }
            }
            blockDraggier.mousedown(e);
          }
        }
      }
    })();

    /* 处理 block 在 container 中拖拽移动的相关动作 */
    const blockDraggier = (() => {
      let dragState = {
        startX: 0,
        startY: 0,
        startPos: [] as { left: number, top: number }[],
        dragging: false
      }

      const mousedown = (e: MouseEvent) => {
        dragState = {
          startX: e.clientX,
          startY: e.clientY,
          startPos: focusData.value.focus.map(({ top, left }) => ({ top, left })),
          dragging: false
        }
        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);
      };

      const mousemove = (e: MouseEvent) => {
        const durX = e.clientX - dragState.startX;
        const durY = e.clientY - dragState.startY;
        if (!dragState.dragging) {
          dragState.dragging = true;
          dragstart.emit()
        }
        focusData.value.focus.forEach((block, index) => {
          block.top = dragState.startPos[index].top + durY;
          block.left = dragState.startPos[index].left + durX;
        })
      };

      const mouseup = () => {
        document.removeEventListener('mousemove', mousemove);
        document.removeEventListener('mouseup', mouseup);
        if (dragState.dragging) {
          dragend.emit()
        }
      };

      return { mousedown };
    })();

    const commander = useVisualCommand({
      focusData,
      updateBlocks: methods.updateBlocks,
      dataModel,
      dragstart,
      dragend
    });

    const buttons = [
      { label: '撤销', icon: 'icon-back', handler: commander.undo, tip: 'ctrl+z' },
      { label: '重做', icon: 'icon-forward', handler: commander.redo, tip: 'ctrl+y,ctrl+shift+z' },
      {
        label: '导入', icon: 'icon-import', handler: async () => {
          const text = await $$dialog.input('', '请输入倒入的JSON字符串')
          try {
            const data = JSON.parse(text || '')
            dataModel.value = data
          } catch (e) {
            console.error(e)
            ElMessageBox.alert('解析json字符串出错')
          }
        }
      },
      {
        label: '导出',
        icon: 'icon-export',
        handler: () => $$dialog.textarea(JSON.stringify(dataModel.value), '导出的JSON数据', { editReadonly: true })
      },
      { label: '置顶', icon: 'icon-place-top', handler: () => commander.placeTop(), tip: 'ctrl+up' },
      { label: '置底', icon: 'icon-place-bottom', handler: () => commander.placeBottom(), tip: 'ctrl+down' },
      { label: '删除', icon: 'icon-delete', handler: () => commander.delete(), tip: 'ctrl+d,backspace,delete' },
      { label: '清空', icon: 'icon-reset', handler: () => commander.clear() },
    ]

    return () => (
      <div class='visual-editor'>
        <div class="visual-editor-menu">
          {props.config.componentList.map(component => (
            <div class="visual-editor-menu-item"
              draggable
              onDragstart={(e) => menuDraggier.dragstart(e, component)}
              onDragend={menuDraggier.dragend}>
              <span class="visual-editor-menu-item-label">
                {component.label}
              </span>
              {component.preview()}
            </div>
          ))}
        </div>
        <div class="visual-editor-head">
          {buttons.map((btn, index) => {
            const content = (<div key={index} class="visual-editor-head-button" onClick={btn.handler}>
              <i class={`iconfont ${btn.icon}`} />
              <span>{btn.label}</span>
            </div>)
            return !btn.tip ? content : <el-tooltip effect="dark" content={btn.tip} placement="bottom">
              {content}
            </el-tooltip>
          }
          )}
        </div>
        <div class="visual-editor-operator">
          visual-editor-operator
        </div>
        <div class="visual-editor-body">
          <div class="visual-editor-content">
            <div class="visual-editor-container"
              style={containerStyles.value}
              ref={containerRef}
              {...focusHandler.container}>

              {!!dataModel.value.blocks && (dataModel.value.blocks.map((block, index) => (
                <VisualEditorBlock
                  config={props.config}
                  block={block}
                  key={index}
                  {...{
                    onMouseDown: (e: MouseEvent) => focusHandler.block.onMouseDown(e, block)
                  }} />
              ))
              )}
            </div>
          </div>
        </div>
      </div >
    )
  }
})