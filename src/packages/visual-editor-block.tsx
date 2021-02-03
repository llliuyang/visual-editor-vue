import { computed, defineComponent, onMounted, PropType, ref, Slot } from "vue";
import { BlockResize } from "./components/block-resizer/block-resize";
import { VisualEditorBlockData, VisualEditorConfig } from "./visual-editor.utils";

export const VisualEditorBlock = defineComponent({
  props: {
    block: {
      type: Object as PropType<VisualEditorBlockData>,
      required: true
    },
    config: {
      type: Object as PropType<VisualEditorConfig>,
      required: true
    },
    formData: {
      type: Object as PropType<Record<string, any>>,
      required: true
    },
    slots: {
      type: Object as PropType<Record<string, Slot | undefined>>,
      required: true
    }
  },
  setup(props) {
    const el = ref({} as HTMLDivElement);
    const classes = computed(() => [
      'visual-editor-block',
      {
        'visual-editor-block-focus': props.block.focus
      }
    ])

    const styles = computed(() => ({
      top: `${props.block.top}px`,
      left: `${props.block.left}px`,
      zIndex: props.block.zIndex
    }))

    onMounted(() => {
      /* 添加组件的时候，自动调整位置，居中放置 */
      const block = props.block;
      if (block.adjustPosition) {
        const { offsetWidth, offsetHeight } = el.value;
        block.left = block.left - offsetWidth / 2;
        block.top = block.top - offsetHeight / 2;
        block.width = offsetWidth;
        block.height = offsetHeight;
        block.adjustPosition = false
      }
    })

    return () => {
      const component = props.config.componentMap[props.block.componentKey];
      const formData = props.formData as Record<string, any>;

      let render: any;
      if (!!props.block.slotName && !!props.slots[props.block.slotName]) {
        render = props.slots[props.block.slotName]!()
      } else {
        render = component.render({
          size: props.block.hasResized ? {
            width: props.block.width,
            height: props.block.height,
          } : {},
          props: props.block.props || {},
          model: Object.keys(component.model || {}).reduce((prev, propName) => {
            const modelName = !props.block.model ? null : props.block.model[propName]
            prev[propName] = {
              [propName === 'default' ? 'modelValue' : propName]: !!modelName ? formData[modelName] : null,
              [propName === 'default' ? 'onUpdate:modelValue' : 'onChange']: (val: any) => !!modelName && (formData[modelName] = val)
            }
            return prev;
          }, {} as Record<string, any>),
        })
      }




      const { width, height } = component.resize || {}

      return (
        <div class={classes.value} style={styles.value} ref={el}>
          {render}

          {!!props.block.focus && (!!width || !!height) &&
            <BlockResize block={props.block} component={component} />
          }
        </div>
      )
    }
  }

})