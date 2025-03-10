import { Condition } from '@/components/widget/bean/Condition'
import { ApplicationContext } from '@/utils/ApplicationContext'
import store from '@/store'

/**
 * 判断两个conditions数组是否相同
 * @param {*} conditions1
 * @param {*} conditions2
 * @returns
 */
export const isChange = (conditions1, conditions2) => {
  // 两个都null
  if (!conditions1 && !conditions2) return false
  if (!conditions1 || !conditions2) return true
  // 数组长度不一样 肯定发生了改变
  if (conditions1.length !== conditions2.length) return true
  let arr1 = JSON.parse(JSON.stringify(conditions1))
  let arr2 = JSON.parse(JSON.stringify(conditions2))
  const strCodeAt = (str) => str[0].charCodeAt()
  arr1 = arr1.sort((s1, s2) => strCodeAt(s1.componentId.trim() || s1.fieldId) - strCodeAt(s2.componentId.trim() || s2.fieldId))
  arr2 = arr2.sort((s1, s2) => strCodeAt(s1.componentId.trim() || s1.fieldId) - strCodeAt(s2.componentId.trim() || s2.fieldId))
  return JSON.stringify(arr1) !== JSON.stringify(arr2)
}

export const valueValid = condition => {
  return condition && condition.value && condition.value.length > 0 && condition.value[0]
}

export const formatCondition = obj => {
  const { component, value, operator, isTree } = obj

  let fieldId = component.options.attrs.fieldId
  const viewIds = component.options.attrs.viewIds
  const parameters = component.options.attrs.parameters
  if (isTree && !component.options.attrs.multiple && value && value.length) {
    // 单选树
    const val = value[0]
    if (val) {
      const len = val.split(',').length
      if (len) {
        fieldId = fieldId.split(',').slice(0, len).join(',')
      }
    }
  }
  const condition = new Condition(component.id, fieldId, operator, value, viewIds, parameters, isTree)
  return condition
}

export const formatLinkageCondition = obj => {
  const { viewIds, fieldId, value, operator } = obj
  const condition = new Condition(null, fieldId, operator, value, viewIds)
  return condition
}

export const viewIdMatch = (viewIds, viewId) => !viewIds || viewIds.length === 0 || viewIds.includes(viewId)
export const buildViewKeyMap = panelItems => {
  const result = {}
  panelItems.forEach(element => {
    if (element.type === 'view') {
      result[element.propValue.viewId] = []
    }
    if (element.type === 'de-tabs') {
      element.options.tabList && element.options.tabList.forEach(tab => {
        if (tab.content && tab.content.propValue && tab.content.propValue.viewId) {
          result[tab.content.propValue.viewId] = []
        }
      })
    }
  })
  return result
}

export const buildCanvasIdMap = panelItems => {
  const result = {}
  panelItems.forEach(element => {
    if (element.type === 'view') {
      result[element.propValue.viewId] = element.canvasId
    }
    if (element.type === 'de-tabs') {
      element.options.tabList && element.options.tabList.forEach(tab => {
        if (tab.content && tab.content.propValue && tab.content.propValue.viewId) {
          result[tab.content.propValue.viewId] = element.id + '-' + tab.name
        }
      })
    }
  })
  return result
}

const cacheCondition = (cb, obj) => {
  obj.cb = cb
}

export const buildViewKeyFilters = (panelItems, result, isEdit = false) => {
  if (!(panelItems && panelItems.length > 0)) {
    return result
  }
  const buildItems = panelItems[0].canvasId === 'canvas-main' ? panelItems : store.state.componentData
  const canvasIdMap = buildCanvasIdMap(buildItems)
  buildItems.forEach((element, index) => {
    if (element.type !== 'custom') {
      return true
    }
    const selectFirst = element.serviceName === 'textSelectWidget' && element.options.attrs.selectFirst

    let param = null
    const widget = ApplicationContext.getService(element.serviceName)
    param = widget.getParam(element)
    const condition = formatCondition(param)
    const vValid = valueValid(condition)
    const filterComponentId = condition.componentId
    Object.keys(result).forEach(viewId => {
      // 进行过滤时 如果过滤组件在主画布 则条件适用于所有画布视图 否则需要过滤组件和视图在相同画布
      if (element.canvasId === 'canvas-main' || element.canvasId === canvasIdMap[viewId]) {
        const vidMatch = viewIdMatch(condition.viewIds, viewId)
        if (vidMatch && selectFirst && !element.options.loaded) {
          const obj = {}
          const promise = new Promise(resolve => {
            cacheCondition(cbParam => {
              const newCondition = getCondition(element, cbParam)
              resolve(newCondition)
            }, obj)
          })
          promise.componentId = filterComponentId
          promise.cacheObj = obj
          result[viewId].push(promise)
        } else {
          const viewFilters = result[viewId]
          let j = viewFilters.length
          while (j--) {
            const filter = viewFilters[j]
            if (filter.componentId === filterComponentId) {
              viewFilters.splice(j, 1)
            }
          }
          vidMatch && vValid && viewFilters.push(condition)
        }
      }
    })
  })
  return result
}
export const buildFilterMap = (panelItems, isEdit = false) => {
  let result = buildViewKeyMap(panelItems)
  result = buildViewKeyFilters(panelItems, result, isEdit)
  return result
}

const getCondition = (element, p) => {
  const widget = ApplicationContext.getService(element.serviceName)
  const param = widget.getParam(element, p?.val)
  const condition = formatCondition(param)
  return condition
}
export const buildAfterFilterLoaded = (originMap, p) => {
  const componentId = p.componentId
  Object.keys(originMap).forEach(viewId => {
    const conditions = originMap[viewId]
    if (conditions?.length) {
      conditions.forEach(condition => {
        if (condition instanceof Promise && condition.componentId === componentId && condition.cacheObj?.cb) {
          condition.cacheObj.cb(p)
        }
      })
    }
  })
}

export const fillElementsFilter = (panelItems, filterMap) => {
  panelItems.forEach(element => {
    if (element.type === 'view') {
      element.filters = filterMap[element.propValue.viewId] || []
    }
    if (element.type === 'de-tabs') {
      element.options.tabList && element.options.tabList.forEach(tab => {
        if (tab.content && tab.content.propValue && tab.content.propValue.viewId) {
          tab.content.filters = filterMap[tab.content.propValue.viewId] || []
        }
      })
    }
  })
}
